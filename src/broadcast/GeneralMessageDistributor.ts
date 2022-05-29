import { MessageDistributor } from "./MessageDistributor"

/**
 * Manages the delivery of messages to local receivers,
 * after these messages have been accepted by the
 * specific strategy extending this abstract class.
 */
export abstract class GeneralMessageDistributor implements MessageDistributor {
	
	private readonly receivers: Set<(message: any) => Promise<void>> = new Set()
	
	/**
	 * @inheritDoc
	 */
	abstract broadcast(message: any): Promise<void>
	
	/**
	 * Add a receiver for a message to be delivered,
	 * to process this message on the local node.
	 * When this receiver is called, it is assumed
	 * to also be called on other nodes (eventually).
	 * @param receiveMessage Callback to deliver the message.
	 */
	addReceiver(receiveMessage: (message: any) => Promise<void>): void {
		this.receivers.add(receiveMessage)
	}
	
	/**
	 * Called when a message should be delivered on the local node.
	 * This should only happen when it can be assumed that this message
	 * will also be delivered on all other correct nodes eventually.
	 * @param message Message to deliver
	 * @protected
	 */
	protected async deliver(message: any): Promise<void> {
		for (const deliver of this.receivers) {
			await deliver(message)
		}
	}
	
}
