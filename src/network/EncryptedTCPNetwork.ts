import { Network, MessageReceiver } from "./Network"
import { TCPNode } from "./TCPNode"

import { Server, createServer, Socket } from "net"
import {
	publicEncrypt,
	privateDecrypt,
	randomUUID,
	createCipheriv,
	createDecipheriv,
	generateKeySync,
	randomBytes,
	generateKeyPairSync
} from "crypto"
import { readFileSync, writeFileSync } from "fs"

/**
 * <code>Network</code> which communicates using TCP.
 * Uses <code>HTTPNode</code>s to specify addresses of its members.
 */
export class EncryptedTCPNetwork implements Network<TCPNode> {
	
	private readonly server: Server = null
	
	private readonly privateKey: Buffer
	
	private readonly readPublicKey: (nodeId: string) => Buffer
	private readonly publicKeys: Map<string, Buffer> = new Map()
	
	private readonly connections: Map<string, Socket> = new Map()
	private readonly connectionKeys: Map<string, Buffer | string> = new Map()
	private readonly bufferedData: Map<string, Array<{ topic: string, message: any }>> = new Map()
	
	private readonly receiversByTopic: Map<string, MessageReceiver> = new Map()
	
	private readonly id: string
	
	private hasStopped: boolean = false
	
	
	constructor(ownId: string, ownNode: TCPNode, privateKeyFilePath: string, getPublicKeyFilePath: (nodeId: string) => string) {
		this.id = ownId
		
		this.privateKey = EncryptedTCPNetwork.readKey(privateKeyFilePath)
		this.readPublicKey = nodeId => EncryptedTCPNetwork.readKey(getPublicKeyFilePath(nodeId))
		
		this.server = createServer(socket => {
			const connectionKey = EncryptedTCPNetwork.generateSymmetricKey()
			
			let senderId: string = null
			
			EncryptedTCPNetwork.setReceiver(socket,
				() => {
					if (senderId === null) {
						return {
							type: 'rsa',
							key: this.privateKey
						}
					} else {
						return {
							type: 'aes',
							key: connectionKey
						}
					}
				},
				async data => {
					if (senderId === null) {
						let nonce: any
						[ senderId, nonce ] = data
						
						const senderPublicKey = this.publicKeys.get(senderId)
						
						EncryptedTCPNetwork.send(
							socket,
							senderPublicKey,
							'rsa',
							[ nonce, connectionKey ]
						)
					} else {
						const [ topic, message ] = data
						
						const receive = this.receiversByTopic.get(topic)
						
						if (receive) {
							await receive(senderId, message)
						}
					}
				}
			)
		})
		
		this.server.listen(ownNode.port, ownNode.host)
	}
	
	/**
	 * Generate private-public key-pair for a node in the network.
	 * @param privateKeyFilePath Path to private-key file, which must not be shared between nodes
	 * @param publicKeyFilePath Path to public-key file, which must be shared between nodes
	 */
	static generateEncryptionKeyFiles(
		privateKeyFilePath: string,
		publicKeyFilePath: string
	) {
		const { publicKey, privateKey } = generateKeyPairSync('rsa', {
			modulusLength: (4096/2),
			publicKeyEncoding: {
				type: 'spki',
				format: 'pem'
			},
			privateKeyEncoding: {
				type: 'pkcs8',
				format: 'pem'
			}
		})
		
		writeFileSync(privateKeyFilePath, privateKey)
		writeFileSync(publicKeyFilePath, publicKey)
	}
	
	async stop() {
		this.hasStopped = true
		this.server.close()
		this.connections.forEach(connection => {
			connection.destroy()
		})
	}
	
	async registerNode(id: string, node: TCPNode): Promise<void> {
		if (id != this.id) {
			const targetPublicKey = this.readPublicKey(id)
			this.publicKeys.set(id, targetPublicKey)
			
			const connect = () => {
				this.connectionKeys.delete(id)
				
				if (this.connections.has(id)) {
					this.connections.get(id).end()
				}
				
				const connection = new Socket()
				this.connections.set(id, connection)
				
				const nonce = randomUUID()
				
				try {
					connection.connect(node.port, node.host)
					
					let hasKey = false
					EncryptedTCPNetwork.setReceiver(connection,
						() => ({
							type: 'rsa',
							key: this.privateKey
						}),
						async data => {
							if (!hasKey) {
								let [ returnedNonce, connectionKey ] = data
								if (returnedNonce == nonce) {
									// In case a buffer was sent as a key
									if (typeof connectionKey !== 'string') {
										connectionKey = Buffer.from(connectionKey.data)
									}
									
									this.connectionKeys.set(id, connectionKey)
									hasKey = true
									
									if (this.bufferedData.has(id)) {
										const bufferedElements = this.bufferedData.get(id)
										for (const { topic, message } of bufferedElements) {
											await this.sendMessage(id, topic, message)
										}
									}
								} else {
									connect()
								}
							}
						}
					)
					
					EncryptedTCPNetwork.send(
						connection,
						targetPublicKey,
						'rsa',
						[ this.id, nonce ]
					)
					
					connection.on('error', connect)
					connection.on('end', connect)
				} catch (e) {
					connect()
				}
			}
			
			connect()
		}
	}
	
	async registerReceiver(topic: string, receiver: MessageReceiver): Promise<void> {
		this.receiversByTopic.set(topic, receiver)
	}
	
	async sendMessage(targetId: string, topic: string, message: any): Promise<void> {
		if (targetId != this.id) {
			const targetNode = this.connections.get(targetId)
			const connectionKey = this.connectionKeys.get(targetId)
			
			if (targetNode && connectionKey) {
				EncryptedTCPNetwork.send(
					targetNode,
					connectionKey,
					'aes',
					[ topic, message ]
				)
			} else {
				if (!this.bufferedData.has(targetId)) {
					this.bufferedData.set(targetId, [])
				}
				
				this.bufferedData.get(targetId).push({
					topic,
					message
				})
			}
		} else {
			const receive = this.receiversByTopic.get(topic)
			if (receive) {
				await receive(targetId, message)
			}
		}
	}
	
	private static readKey(keyFilePath: string): Buffer {
		return readFileSync(keyFilePath)
	}
	
	private static generateSymmetricKey(): Buffer | string {
		return generateKeySync('aes', {
			length: 256
		}).export()
	}
	
	private static encryptRSA(publicKey: Buffer | string, portionSize: number, data: any): Buffer {
		const encrypted: Array<Buffer> = []
		
		const buffer = Buffer.from(JSON.stringify(data))
		for (let start = 0; buffer.length > start; start += portionSize) {
			let end = start + portionSize
			if (end > buffer.length) {
				end = buffer.length
			}
			
			const portion = buffer.subarray(start, end)
			const encryptedPortion = publicEncrypt(publicKey, portion)
			
			encrypted.push(
				Buffer.from(encryptedPortion.length.toString()),
				Buffer.of(0),
				encryptedPortion
			)
		}
		
		return Buffer.concat(encrypted)
	}
	
	private static decryptRSA(privateKey: Buffer | string, buffer: Buffer): any {
		const decryptedPortions: Array<Buffer> = []
		
		let rest: Buffer = buffer
		while (rest.length > 0) {
			const portionSizeEnd = rest.findIndex(num => num == 0)
			
			if (portionSizeEnd > 0) {
				const portionSize = - -(rest.subarray(0, portionSizeEnd).toString())
				
				if (portionSize > 0) {
					const start = portionSizeEnd + 1
					const portion = rest.subarray(start, start + portionSize)
					rest = rest.subarray(start + portionSize)
					
					const decryptedPortion = privateDecrypt(privateKey, portion)
					
					decryptedPortions.push(decryptedPortion)
				} else {
					throw "Received incorrectly encoded data!"
				}
			} else {
				throw "Received incorrectly encoded data!"
			}
		}
		
		const decrypted = Buffer.concat(decryptedPortions)
		return JSON.parse(decrypted.toString())
	}
	
	private static encryptAES(key: Buffer | string, data: any): Buffer {
		const iv = randomBytes(16)
		
		const cipher = createCipheriv('aes-256-cbc', key, iv)
		
		return Buffer.concat([
			iv,
			cipher.update(JSON.stringify(data), 'utf-8'),
			cipher.final()
		])
	}
	
	private static decryptAES(key: Buffer | string, buffer: Buffer): any {
		const iv = buffer.subarray(0, 16)
		const encrypted = buffer.subarray(16)
		
		const decipher = createDecipheriv('aes-256-cbc', key, iv)
		const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
		
		return JSON.parse(decrypted.toString())
	}
	
	private static send(
		connection: Socket,
		key: Buffer | string,
		encryptionType: 'rsa' | 'aes',
		data: any
	): void {
		const encrypted = encryptionType === 'rsa' ?
			this.encryptRSA(key, 2048/8 - 45, data) : this.encryptAES(key, data)
		
		connection.write(Buffer.concat([
			Buffer.from(encrypted.length.toString()),
			Buffer.of(0),
			encrypted
		]))
	}
	
	private static setReceiver(
		connection: Socket,
		getDecryptionKey: () => { type: 'rsa' | 'aes', key: Buffer | string },
		receive: (data: any) => Promise<void>
	): void {
		let lastBuffer: Buffer = Buffer.of()
		
		connection.on('data', async buffer => {
			buffer = Buffer.concat([lastBuffer, buffer])
			
			while (buffer.length > 0) {
				const lengthEnd = buffer.findIndex(num => num == 0)
				
				if (lengthEnd > 0) {
					const length = - -(buffer.subarray(0, lengthEnd).toString())
					const contentStart = lengthEnd + 1
					
					if (contentStart + length <= buffer.length) {
						const content = buffer.subarray(contentStart, contentStart + length)
						buffer = buffer.subarray(contentStart + length)
						
						if (content.length > 0) {
							try {
								const { type: encryptionType, key } = getDecryptionKey()
								
								const data = encryptionType === 'rsa' ?
									this.decryptRSA(key, content) : this.decryptAES(key, content)
								
								await receive(data)
							} catch (e) {
								console.error(e, content)
							}
						}
					} else {
						break
					}
				} else {
					break
				}
			}
			
			lastBuffer = buffer
		})
	}
	
}
