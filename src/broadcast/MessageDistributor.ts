
/**
 * Handles messages to distribute in a distributed system.
 */
export interface MessageDistributor {
	
	/**
	 * Add a receiver function to be called when a message
	 * is to be delivered on this node.
	 */
	addReceiver(deliverMessage: (message: any) => Promise<void>): void
	
	/**
	 * Broadcasts a message to every member in the network.
	 * @param message Serializable message to send
	 */
	broadcast(message: any): Promise<void>
	
}
