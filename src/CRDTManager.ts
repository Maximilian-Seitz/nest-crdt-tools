import { CRDT, CRDTDefinedBy, create, MessageHandler, Type } from "nest-crdt"
import { MessageDistributor } from "./broadcast"
import { CachedMessageHandler } from "./CachedMessageHandler"

/**
 * Wrapper to manage CRDTs in a system.
 * Requires a message distribution strategy for the <code>MessageHandler</code>.
 */
export class CRDTManager<TypeStore extends Record<string, Type<any, any, any, any>>> {
	
	private readonly typeStore: TypeStore
	private readonly cachedCRDTs: Map<string, CRDT<any, any, any, any>>
	private readonly messageHandler: MessageHandler
	
	/**
	 * @param typeStore Behaviors available to CRDTs in this system
	 * @param broadcast Message distribution strategy throughout the system
	 */
	constructor(
		typeStore: TypeStore,
		broadcast: MessageDistributor
	) {
		this.typeStore = typeStore
		this.cachedCRDTs = new Map()
		this.messageHandler = new CachedMessageHandler(
			this.typeStore,
			this.cachedCRDTs,
			broadcast
		)
	}
	
	/**
	 * Returns the requested CRDT, creating it if it doesn't exist already.
	 * @param id Unique ID of the CRDT within the network
	 * @param typeName The name of the CRDT behavior in the <code>typeStore</code>
	 */
	get<TypeName extends (keyof TypeStore) & string>(
		id: string,
		typeName: TypeName
	): CRDTDefinedBy<TypeStore[TypeName]> {
		return create(id, typeName, this.messageHandler, this.typeStore, this.cachedCRDTs)
	}
	
}
