import { CRDT, Type, CRDTReference, createFromReference, MessageHandler } from "nest-crdt"

import { MessageDistributor } from "./broadcast"
import { SerializedMap } from "./util"


/**
 * Simple <code>MessageHandler</code> which ensures that all messages are eventually delivered,
 * as long as the underlying broadcast implementation ensures the same.
 */
export class CachedMessageHandler implements MessageHandler {
	
	private readonly typeStore: Record<string, Type<any, any, any, any>>
	private readonly cachedCRDTs: Map<string, CRDT<any, any, any, any>>
	
	private readonly broadcast: MessageDistributor
	
	private readonly messageReceiverByTarget: Map<CRDTReference, (message: any) => void> = new SerializedMap()
	
	/**
	 * @param typeStore Behaviors available for CRDTs in this network
	 * @param cachedCRDTs Storage for previously created CRDTs (expected to be empty at first)
	 * @param broadcast Message distribution strategy throughout the network
	 */
	constructor(
		typeStore: Record<string, Type<any, any, any, any>>,
		cachedCRDTs: Map<string, CRDT<any, any, any, any>>,
		broadcast: MessageDistributor
	) {
		this.typeStore = typeStore
		this.cachedCRDTs = cachedCRDTs
		this.broadcast = broadcast
		
		this.broadcast.addReceiver(async msg => {
			const { target, message } = <AnnotatedMessage> msg
			this.deliverMessage(target, message)
		})
	}
	
	public addReceiverFor(target: CRDTReference, handleMessage: (message: any) => void): void {
		if (this.messageReceiverByTarget.has(target)) {
			throw Error("Receiver for target CRDT already exists! Shouldn't exist a second time!")
		}
		
		this.messageReceiverByTarget.set(target, handleMessage)
	}
	
	public async sendMessageTo(target: CRDTReference, message: any): Promise<void> {
		const annotatedMessage: AnnotatedMessage = {
			target,
			message
		}
		
		await this.broadcast.broadcast(annotatedMessage)
	}
	
	private deliverMessage(target: CRDTReference, message: any): void {
		if (!this.messageReceiverByTarget.has(target)) {
			// Create the CRDT, if it doesn't have a receiver.
			// This puts the CRDT in the cache, where it can be used later,
			// and creates it with the message handler being created.
			// This should ensure the CRDT exists, with the current message handler,
			// except if it was created before, with a different message handler
			// (this is not allowed, as all CRDTs must be managed by a single message handler).
			createFromReference(target, this, this.typeStore, this.cachedCRDTs)
		}
		
		const handleMessage = this.messageReceiverByTarget.get(target)
		
		if (!handleMessage) {
			throw Error(
				"Message handler for targeted CRDT doesn't exist! " +
				"Maybe the CRDT was created using a different message handler; " +
				"this shouldn't happen!")
		}
		
		handleMessage(message)
	}
	
}

interface AnnotatedMessage {
	target: CRDTReference
	message: any
}
