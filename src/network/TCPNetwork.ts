import { Network, MessageReceiver } from "./Network"
import { TCPNode } from "./TCPNode"

import { Server, createServer, Socket } from "net"

/**
 * <code>Network</code> which communicates using TCP.
 * Uses <code>HTTPNode</code>s to specify addresses of its members.
 * Doesn't fulfill the requirement of verifying the sender of a message (yet).
 */
export class TCPNetwork implements Network<TCPNode> {
	
	private readonly server: Server = null
	
	private readonly connections: Record<string, Socket> = {}
	
	private readonly receiversByTopic: Map<string, MessageReceiver> = new Map()
	
	private readonly id: string
	
	private hasStopped: boolean = false
	
	
	constructor(ownId: string, ownNode: TCPNode) {
		this.id = ownId
		
		this.server = createServer(socket => {
			let senderId: string = null
			
			TCPNetwork.setReceiver(socket, async data => {
				let [ topic, message ] = data
				
				if (topic == "senderId") {
					senderId = message
				} else {
					if (topic.endsWith("senderId")) {
						topic = topic.substring(1)
					}
					
					const receive = this.receiversByTopic.get(topic)
					
					if (receive) {
						await receive(senderId, message)
					}
				}
			})
		})
		
		this.server.listen(ownNode.port, ownNode.host)
	}
	
	async stop() {
		this.hasStopped = true
		this.server.close()
		Object.values(this.connections).forEach(connection => {
			connection.destroy()
		})
	}
	
	async registerNode(id: string, node: TCPNode): Promise<void> {
		if (id != this.id) {
			if (this.connections[id]) {
				this.connections[id].end()
			}
			
			const connection = new Socket()
			
			const connect = () => {
				if (!this.hasStopped) {
					connection.connect(node.port, node.host)
					
					TCPNetwork.send(
						connection,
						[ "senderId", this.id ]
					)
				}
			}
			
			connection.on('error', connect)
			connection.on('end', connect)
			
			connect()
			
			this.connections[id] = connection
		}
	}
	
	async registerReceiver(topic: string, receiver: MessageReceiver): Promise<void> {
		this.receiversByTopic.set(topic, receiver)
	}
	
	async sendMessage(targetId: string, topic: string, message: any): Promise<void> {
		if (targetId != this.id) {
			const targetNode = this.connections[targetId]
			
			if (topic.endsWith("senderId")) {
				topic = `_${topic}`
			}
			
			TCPNetwork.send(
				targetNode,
				[ topic, message ]
			)
		} else {
			const receive = this.receiversByTopic.get(topic)
			if (receive) {
				await receive(targetId, message)
			}
		}
	}
	
	private static send(
		connection: Socket,
		data: any
	): void {
		const buffer = Buffer.from(JSON.stringify(data))
		
		connection.write(Buffer.concat([
			Buffer.from(buffer.length.toString()),
			Buffer.of(0),
			buffer
		]))
	}
	
	private static setReceiver(
		connection: Socket,
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
								await receive(JSON.parse(content.toString()))
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
