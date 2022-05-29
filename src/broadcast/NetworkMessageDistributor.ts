import { GeneralMessageDistributor } from "./GeneralMessageDistributor"

import { MessageReceiver, Network, waitForEveryone } from "../network"


/**
 * An abstract message distributor that distributes messages to all <code>Node</code>s in a network.
 *
 * @param Node Description of a single node in the used network.
 */
export abstract class NetworkMessageDistributor<Node> extends GeneralMessageDistributor {
	
	/**
	 * Topic to use for setup messages.
	 * This is reserved, and should not be used for any other messages
	 * by the extending classes of this abstract class.
	 * @protected
	 */
	protected static readonly SETUP_TOPIC: string = 'NETWORK_MESSAGE_DISTRIBUTOR_SETUP_TOPIC'
	
	/**
	 * ID of this node in the network.
	 * @protected
	 */
	protected readonly id: string
	
	/**
	 * IDs of all the nodes in the network.
	 * @protected
	 */
	protected get nodeIDs(): Array<string> {
		return Object.keys(this.nodes)
	}
	
	/**
	 * All nodes in the network associated with their IDs.
	 * @private
	 */
	private readonly nodes: Record<string, Node>
	
	/**
	 * The network used to communicate with other nodes.
	 * @private
	 */
	private readonly network: Network<Node>
	
	
	/**
	 * @param id ID of this node in the network
	 * @param nodes All nodes in the network
	 * @param network The network to use to communicate
	 * @param receiversByTopic Receivers for messages for the topics
	 * @protected
	 */
	protected constructor(
		id: string,
		nodes: Record<string, Node>,
		network: Network<Node>,
		receiversByTopic: Record<string, MessageReceiver>
	) {
		super()
		
		this.id = id
		this.nodes = nodes
		this.network = network
		
		// Register other nodes in network
		Object.entries(this.nodes).forEach(async ([nodeId, node]) => {
			await this.network.registerNode(nodeId, node)
		})
		
		// Register receivers for topics
		Object.entries(receiversByTopic).forEach(async ([topic, receive]) => {
			await this.network.registerReceiver(topic, receive)
		})
	}
	
	/**
	 * Wait for a setup message from every node in the network,
	 * and send a ready message to every node once,
	 * and once again when a message has been received.
	 */
	async init(): Promise<this> {
		const otherNodes = new Set(Object.keys(this.nodes))
		otherNodes.delete(this.id)
		
		await waitForEveryone(
			this.network,
			NetworkMessageDistributor.SETUP_TOPIC,
			otherNodes
		)
		
		return this
	}
	
	/**
	 * @inheritDoc
	 */
	abstract broadcast(message: any): Promise<void>
	
	/**
	 * Send message to a specific node in the network.
	 * @param targetId ID of the target node
	 * @param topic Topic to use for this message
	 * @param message Serializable message content to send
	 * @protected
	 */
	protected async sendMessage(targetId: string, topic: string, message: any): Promise<void> {
		await this.network.sendMessage(targetId, topic, message)
	}
	
	/**
	 * Disconnect from the network, stopping the server
	 * waiting for messages from other nodes.
	 */
	async disconnect() {
		await this.network.stop()
	}
	
}
