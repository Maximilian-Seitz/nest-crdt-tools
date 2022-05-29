import { GeneralMessageDistributor } from "./GeneralMessageDistributor"

/**
 * Message distributor for a network with only this single node.
 * Will take any messages and deliver them immediately.
 */
export class LocalMessageDistributor extends GeneralMessageDistributor {
	
	/**
	 * @inheritDoc
	 */
	async broadcast(message: any): Promise<void> {
		await this.deliver(message)
	}
	
}
