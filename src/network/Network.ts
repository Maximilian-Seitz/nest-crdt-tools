
/**
 * A <code>Network</code> is capable of relaying a given message to a <code>Node</code> in that network.
 *
 * Every <code>Network</code> must hold the following properties:
 * <ul>
 *     <li>A message sent to a correct node will eventually trigger the receiver on that node (only) exactly once.</li>
 *     <li>
 *         Whenever a receiver is called, the sender of the message is verified to be the correct member of the network
 *         (meaning no other member of the network can pretend to send a message to another).
 *     </li>
 * </ul>
 *
 * Following information must be provided to a <code>Network</code>:
 * <ul>
 *     <li>The <code>Node</code> of every member of the network (associated with its ID).</li>
 *     <li>The <code>MessageReceiver</code> for every topic that can be expected to be used in the network.</li>
 *     <li>When it is no longer needed, and can be stopped.</li>
 * </ul>
 *
 * @param Node Connection information for a member of this network. Dependent on the implementation.
 */
export interface Network<Node> {
	
	registerNode(id: string, node: Node): Promise<void>
	
	registerReceiver(topic: string, receive: MessageReceiver): Promise<void>
	
	sendMessage(targetId: string, topic: string, message: any): Promise<void>
	
	stop(): Promise<void>
	
}

/**
 * A receiver for a message. Will be called with the id of the verified sender of that message (and the message).
 */
export type MessageReceiver = (senderId: string, message: any) => Promise<void>

/**
 * Helper function to wait until every member of a network has been reached at least once.
 * @param network The <code>Network</code> to use for communication.
 * @param setupTopic A topic which has no <code>MessageReceiver</code> in the <code>Network</code>.
 * @param otherIDs The IDs of the members of the network which will be waited for.
 */
export async function waitForEveryone(
	network: Network<any>,
	setupTopic: string,
	otherIDs: Set<string>
): Promise<void> {
	return new Promise<void>( async (resolve, _) => {
		const missingNodes = new Set(otherIDs)
		
		// Whenever another node sends a ready message
		// register this node as ready
		// and send a ready message back.
		await network.registerReceiver(
			setupTopic,
			async greeterId => {
				if (missingNodes.has(greeterId)) {
					missingNodes.delete(greeterId)
					
					await network.sendMessage(
						greeterId,
						setupTopic,
						null
					)
					
					if (missingNodes.size == 0) {
						resolve()
					}
				}
			}
		)
		
		// Tell every other node in the network
		// that this node is ready!
		otherIDs.forEach(otherId => {
			network.sendMessage(
				otherId,
				setupTopic,
				null
			)
		})
	})
}
