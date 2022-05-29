import { NetworkMessageDistributor } from "./NetworkMessageDistributor"

import { Network } from "../network"

import { v4 as uuid } from "uuid"

import { createHash } from "crypto"

import { SerializedSet } from "../util"


/**
 * A message distributor that uses reliable-broadcast.
 * @param Node Description of a single node in the used network.
 */
export class ReliableMessageDistributor<Node> extends NetworkMessageDistributor<Node> {
	
	private readonly messageStates: Map<string, MessageState> = new Map()
	
	/**
	 * @param id ID of this node in the network
	 * @param nodes All nodes in the network
	 * @param network The network to use to communicate
	 */
	constructor(id: string, nodes: Record<string, Node>, network: Network<Node>) {
		super(id, nodes, network,
			{
				"initial": async (senderId, messageWithId) => {
					if (isMessageWithId(messageWithId)) {
						await this.echoMessage([
							...messageWithId,
							senderId
						])
					}
				},
				
				"echo": async (senderId, annotatedMessage) => {
					if (isAnnotatedMessage(annotatedMessage)) {
						this.registerEchoMessage(senderId, annotatedMessage)
						
						if (this.isMessageReady(annotatedMessage)) {
							await this.echoMessage(annotatedMessage)
							await this.readyMessage(annotatedMessage)
						}
					}
				},
				
				"ready": async (senderId, annotatedMessage) => {
					if (isAnnotatedMessage(annotatedMessage)) {
						this.registerReadyMessage(senderId, annotatedMessage)
						
						if (this.isMessageReady(annotatedMessage)) {
							await this.echoMessage(annotatedMessage)
							await this.readyMessage(annotatedMessage)
						}
						
						if (this.isMessageAccepted(annotatedMessage)) {
							await this.acceptMessage(annotatedMessage)
						}
					}
				}
			}
		)
	}
	
	/**
	 * @inheritDoc
	 */
	async broadcast(message: any): Promise<void> {
		await this.sendToEveryone("initial", withId(message))
	}
	
	/**
	 * Number of nodes in the network
	 * @private
	 */
	private get nodeCount(): number {
		return this.nodeIDs.length
	}
	
	/**
	 * Maximum number of nodes that may be faulty in
	 * order for this algorithm to still work as intended.
	 * @private
	 */
	private get faultyNodeCount(): number {
		return Math.floor((this.nodeCount - 1) / 3)
	}
	
	
	/**
	 * Sends echo for message, if not already done.
	 * @param annotatedMessage Message to echo
	 * @private
	 */
	private async echoMessage(annotatedMessage: AnnotatedMessage): Promise<void> {
		const messageState = this.getMessageState(annotatedMessage)
		
		if (!messageState.wasEchoSent) {
			messageState.wasEchoSent = true
			await this.sendToEveryone(
				"echo",
				annotatedMessage
			)
		}
	}
	
	/**
	 * Sends ready signal for message, if not already done.
	 * @param annotatedMessage Message to send ready signal for
	 * @private
	 */
	private async readyMessage(annotatedMessage: AnnotatedMessage): Promise<void> {
		const messageState = this.getMessageState(annotatedMessage)
		
		if (!messageState.wasReadySent) {
			messageState.wasReadySent = true
			
			// Clean up some memory
			messageState.echoSenders = null
			
			await this.sendToEveryone(
				"ready",
				annotatedMessage
			)
		}
	}
	
	/**
	 * Sends ready signal for message, if not already done.
	 * Also sends the echo, if not already done.
	 * @param annotatedMessage Message to send ready signal for
	 * @private
	 */
	private async acceptMessage(annotatedMessage: AnnotatedMessage): Promise<void> {
		const messageState = this.getMessageState(annotatedMessage)
		
		if (!messageState.wasAccepted) {
			messageState.wasAccepted = true
			
			// Clean up some memory
			messageState.readySenders = null
			
			await this.deliver(getContentOfMessage(annotatedMessage))
		}
	}
	
	/**
	 * Check if an echo has been received for a message from
	 * enough processes (<code>(n+f)/2</code>),
	 * or if a ready message has been received for a message
	 * from enough processes (<code>f+1</code>)
	 * for it to be considered ready.
	 * @param annotatedMessage Message to check for
	 * @private
	 */
	private isMessageReady(annotatedMessage: AnnotatedMessage) {
		const messageState = this.getMessageState(annotatedMessage)
		
		return (messageState.readySenders && (messageState.readySenders.size >= (this.faultyNodeCount + 1)))
			|| (messageState.echoSenders && (messageState.echoSenders.size > ((this.nodeCount + this.faultyNodeCount)/2)))
	}
	
	/**
	 * Check if a ready message has been received for a message from
	 * enough processes (<code>2*f + 1</code>),
	 * for it to be accepted.
	 * @param annotatedMessage Message to check for
	 * @private
	 */
	private isMessageAccepted(annotatedMessage: AnnotatedMessage) {
		const messageState = this.getMessageState(annotatedMessage)
		
		return messageState.readySenders
			&& (messageState.readySenders.size >= (2*this.faultyNodeCount + 1))
	}
	
	/**
	 * Registers a sender as having sent an echo for a message.
	 * @param senderId ID of sender to register
	 * @param annotatedMessage Message to register the echo for
	 * @private
	 */
	private registerEchoMessage(senderId: string, annotatedMessage: AnnotatedMessage) {
		const messageState = this.getMessageState(annotatedMessage)
		if (messageState.echoSenders) {
			messageState.echoSenders.add(senderId)
		}
	}
	
	/**
	 * Registers a sender as having sent a ready for a message.
	 * @param senderId ID of sender to register
	 * @param annotatedMessage Message to register the ready for
	 * @private
	 */
	private registerReadyMessage(senderId: string, annotatedMessage: AnnotatedMessage) {
		const messageState = this.getMessageState(annotatedMessage)
		if (messageState.readySenders) {
			messageState.readySenders.add(senderId)
		}
	}
	
	
	/**
	 * Gets the state of a specified message
	 * (will be initialized if none existed).
	 * @param annotatedMessage Message to get the state for
	 * @private
	 */
	private getMessageState(annotatedMessage: AnnotatedMessage): MessageState {
		const hashedMessage = ReliableMessageDistributor.hashMessage(annotatedMessage)
		
		if (!this.messageStates.has(hashedMessage)) {
			this.messageStates.set(hashedMessage, {
				wasEchoSent: false,
				wasReadySent: false,
				wasAccepted: false,
				
				echoSenders: new SerializedSet(),
				readySenders: new SerializedSet()
			})
		}
		
		return this.messageStates.get(hashedMessage)
	}
	
	/**
	 * Create a <code>HashedMessage</code> from an <code>AnnotatedMessage</code>
	 * in order to store less data, but still be able to check if information
	 * about a message really contains the same message.
	 * @param annotatedMessage Message to create a hashed version of
	 * @private
	 */
	private static hashMessage(annotatedMessage: AnnotatedMessage): string {
		const hash: string = createHash('sha256')
			.update(JSON.stringify(annotatedMessage))
			.digest('base64')
		
		return JSON.stringify([
			getIdOfMessage(annotatedMessage),
			hash
		])
	}
	
	
	/**
	 * Sends a message to every node in the network.
	 * @param topic Topic of the message
	 * @param message Serializable message
	 * @private
	 */
	private async sendToEveryone(topic: string, message: any): Promise<void> {
		this.nodeIDs.forEach(nodeId => {
			this.sendMessage(nodeId, topic, message)
		})
	}
}

/**
 * Annotates a message with a unique ID
 * @param message Message to annotate
 */
function withId(message: any): MessageWithId {
	return [
		uuid(),
		message
	]
}

function getIdOfMessage(message: MessageWithId | AnnotatedMessage): string {
	return message[0]
}

function getContentOfMessage(message: MessageWithId | AnnotatedMessage): any {
	return message[1]
}

function getSenderIfOfMessage(message: AnnotatedMessage): any {
	return message[2]
}

/**
 * Message annotated with a unique ID
 * (a tuple where first element is the ID,
 * and the second element is the message)
 */
type MessageWithId = [string, any]


function isMessageWithId(o: any): o is MessageWithId {
	return Array.isArray(o) && o.length == 2 && (typeof o[0] === 'string')
}

/**
 * Uniquely identifiable message from some original sender
 * (a tuple where first element is the ID,
 * the second element is the message and
 * the third element is the initial sender's ID)
 */
type AnnotatedMessage = [...MessageWithId, string]

function isAnnotatedMessage(o: any): o is AnnotatedMessage {
	return Array.isArray(o) && o.length == 3 && (typeof o[0] === 'string') && (typeof o[2] === 'string')
}

/**
 * State of a message
 * (to know how far it has been processed,
 * and what information has been received about it).
 */
interface MessageState {
	wasEchoSent: boolean
	wasReadySent: boolean
	wasAccepted: boolean
	
	echoSenders?: Set<string>
	readySenders?: Set<string>
}
