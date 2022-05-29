
export class SerializedSet<T> implements Set<T> {
	
	private readonly delegate: Set<string> = new Set()
	private readonly serializeValue: (value: T) => string
	private readonly deserializeValue: (serializedValue: string) => T
	
	constructor(
		serializeValue?: (value: T) => string,
		deserializeValue?: (serializedValue: string) => T
	) {
		this.serializeValue = serializeValue || JSON.stringify
		this.deserializeValue = deserializeValue || JSON.parse
	}
	
	get size(): number {
		return this.delegate.size
	}
	
	add(value: T): this {
		this.delegate.add(this.serializeValue(value))
		return this
	}
	
	clear(): void {
		this.delegate.clear()
	}
	
	delete(value: T): boolean {
		return this.delegate.delete(this.serializeValue(value))
	}
	
	forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void {
		this.delegate.forEach((value, value2) => {
			if (thisArg) {
				callbackfn.call(thisArg, this.deserializeValue(value), this.deserializeValue(value2), this)
			} else {
				callbackfn(this.deserializeValue(value), this.deserializeValue(value2), this)
			}
		})
	}
	
	has(value: T): boolean {
		return this.delegate.has(this.serializeValue(value))
	}
	
	[Symbol.iterator](): IterableIterator<T> {
		return this.values()
	}
	
	entries(): IterableIterator<[T, T]> {
		const itDelegate = this.delegate.values()
		const thiz = this
		
		return <IterableIterator<[T, T]>> {
			[Symbol.iterator](): IterableIterator<[T, T]> {
				return thiz.entries()
			},
			
			next(): IteratorResult<[T, T], any> {
				let { value, done } = itDelegate.next()
				if (!done) {
					const val = thiz.deserializeValue(value)
					value = [val, val]
				}
				return { value, done }
			},
			
			return(val: any): IteratorResult<[T, T], any> {
				let { value, done } = itDelegate.return(val)
				if (!done) {
					const val = thiz.deserializeValue(value)
					value = [val, val]
				}
				return { value, done }
			},
			
			throw(e: any): IteratorResult<[T, T], any> {
				let { value, done } = itDelegate.throw(e)
				if (!done) {
					const val = thiz.deserializeValue(value)
					value = [val, val]
				}
				return { value, done }
			}
		}
	}
	
	keys(): IterableIterator<T> {
		return this.values()
	}
	
	values(): IterableIterator<T> {
		const itDelegate = this.delegate.values()
		const thiz = this
		
		return <IterableIterator<T>> {
			[Symbol.iterator](): IterableIterator<T> {
				return thiz.values()
			},
			
			next(): IteratorResult<T, any> {
				let { value, done } = itDelegate.next()
				if (!done) value = thiz.deserializeValue(value)
				return { value, done }
			},
			
			return(val: any): IteratorResult<T, any> {
				let { value, done } = itDelegate.return(val)
				if (!done) value = thiz.deserializeValue(value)
				return { value, done }
			},
			
			throw(e: any): IteratorResult<T, any> {
				let { value, done } = itDelegate.throw(e)
				if (!done) value = thiz.deserializeValue(value)
				return { value, done }
			}
		}
	}
	
	get [Symbol.toStringTag](): string {
		let content = ""
		
		this.delegate.forEach(value => {
			if (content) {
				content += ", "
			}
			
			content += value
		})
		
		return "{" + content + "}"
	}
	
}
