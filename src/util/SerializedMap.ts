
export class SerializedMap<K, V> implements Map<K, V> {
	
	private readonly delegate: Map<string, V> = new Map()
	private readonly serializeKey: (value: K) => string
	private readonly deserializeKey: (serializedValue: string) => K
	
	constructor(
		serializeKey?: (value: K) => string,
		deserializeKey?: (serializedKey: string) => K
	) {
		this.serializeKey = serializeKey || JSON.stringify
		this.deserializeKey = deserializeKey || JSON.parse
	}
	
	get size(): number {
		return this.delegate.size
	}
	
	has(key: K): boolean {
		return this.delegate.has(this.serializeKey(key))
	}
	
	get(key: K): V | undefined {
		return this.delegate.get(this.serializeKey(key))
	}
	
	set(key: K, value: V): this {
		this.delegate.set(this.serializeKey(key), value)
		return this
	}
	
	delete(key: K): boolean {
		return this.delegate.delete(this.serializeKey(key))
	}
	
	clear(): void {
		this.delegate.clear()
	}
	
	forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
		this.delegate.forEach((value, key) => {
			if (thisArg) {
				callbackfn.call(thisArg, value, this.deserializeKey(key), this)
			} else {
				callbackfn(value, this.deserializeKey(key), this)
			}
		})
	}
	
	[Symbol.iterator](): IterableIterator<[K, V]> {
		return this.entries();
	}
	
	keys(): IterableIterator<K> {
		const itDelegate = this.delegate.keys()
		const thiz = this
		
		return <IterableIterator<K>> {
			[Symbol.iterator](): IterableIterator<K> {
				return thiz.keys()
			},
			
			next(): IteratorResult<K, any> {
				let { value, done } = itDelegate.next()
				if (!done) value = thiz.deserializeKey(value)
				return { value, done }
			},
			
			return(v: any): IteratorResult<[K, V], any> {
				let { value, done } = itDelegate.return(v)
				if (!done) value = thiz.deserializeKey(value)
				return { value, done }
			},
			
			throw(e: any): IteratorResult<[K, V], any> {
				let { value, done } = itDelegate.throw(e)
				if (!done) value = thiz.deserializeKey(value)
				return { value, done }
			}
		}
	}
	
	entries(): IterableIterator<[K, V]> {
		const itDelegate = this.delegate.entries()
		const thiz = this
		
		return <IterableIterator<[K, V]>> {
			[Symbol.iterator](): IterableIterator<[K, V]> {
				return thiz.entries()
			},
			
			next(): IteratorResult<[K, V], any> {
				let { value: val, done } = itDelegate.next()
				if (!done) {
					const [key, value] = val
					val = [thiz.deserializeKey(key), value]
				}
				return { value: val, done }
			},
			
			return(v: any): IteratorResult<[K, V], any> {
				let { value: val, done } = itDelegate.return(v)
				if (!done) {
					const [key, value] = val
					val = [thiz.deserializeKey(key), value]
				}
				return { value: val, done }
			},
			
			throw(e: any): IteratorResult<[K, V], any> {
				let { value: val, done } = itDelegate.throw(e)
				if (!done) {
					const [key, value] = val
					val = [thiz.deserializeKey(key), value]
				}
				return { value: val, done }
			}
		}
	}
	
	values(): IterableIterator<V> {
		return this.delegate.values()
	}
	
	get [Symbol.toStringTag](): string {
		let content = ""
		
		this.delegate.forEach((value, key) => {
			if (content) {
				content += ", "
			}
			
			content += key + ": " + value
		})
		
		return "{" + content + "}"
	}
	
}
