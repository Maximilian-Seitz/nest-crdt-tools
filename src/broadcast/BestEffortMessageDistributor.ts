import { NetworkMessageDistributor } from "./NetworkMessageDistributor"

import { Network } from "../network"


/**
 * A message distributor that uses best-effort-broadcast
 * (meaning it transmits every message to every node in the network,
 * and delivers every message it receives).
 * This works well without byzantine faults, as long as the sending node
 * doesn't crash while it is transmitting messages to the children.
 *
 * @param Node Description of a single node in the used network.
 */
export class BestEffortMessageDistributor<Node> extends NetworkMessageDistributor<Node> {
	
	/**
	 * @param id ID of this node in the network
	 * @param nodes All nodes in the network
	 * @param network The network to use to communicate
	 */
	constructor(id: string, nodes: Record<string, Node>, network: Network<Node>) {
		super(id, nodes, network,
			{
				"MESSAGE": async (_, message) => {
					await this.deliver(message)
				}
			}
		)
	}
	
	/**
	 * @inheritDoc
	 */
	async broadcast(message: any): Promise<void> {
		this.nodeIDs.forEach(targetId => {
			this.sendMessage(
				targetId,
				"MESSAGE",
				message
			)
		})
	}
	
}
