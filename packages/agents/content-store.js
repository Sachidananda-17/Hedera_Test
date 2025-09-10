/**
 * Content Store - Local storage for uploaded content
 * Allows orchestrator to access content immediately without waiting for IPFS propagation
 */

class ContentStore {
    constructor() {
        this.storage = new Map();
        this.log("🗃️ Content Store initialized");
    }

    log(message, level = 'INFO', data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ContentStore ${level}: ${message}`);
        if (data) console.log('Details:', data);
    }

    /**
     * Store content with CID for immediate access
     * @param {string} cid - IPFS CID
     * @param {string} content - Content text
     * @param {Object} metadata - Additional metadata
     */
    store(cid, content, metadata = {}) {
        const record = {
            cid,
            content,
            metadata: {
                ...metadata,
                storedAt: new Date().toISOString(),
                size: content.length
            }
        };

        this.storage.set(cid, record);
        
        this.log(`📦 Content stored for CID: ${cid}`, 'SUCCESS', {
            size: content.length,
            metadata: metadata
        });

        // Auto-cleanup old entries (keep last 100)
        if (this.storage.size > 100) {
            const firstKey = this.storage.keys().next().value;
            this.storage.delete(firstKey);
        }

        return record;
    }

    /**
     * Retrieve content by CID
     * @param {string} cid - IPFS CID
     * @returns {Object|null} Content record or null if not found
     */
    get(cid) {
        const record = this.storage.get(cid);
        
        if (record) {
            this.log(`✅ Content retrieved for CID: ${cid}`, 'SUCCESS');
            return record;
        } else {
            this.log(`❌ Content not found for CID: ${cid}`, 'WARN');
            return null;
        }
    }

    /**
     * Check if content exists
     * @param {string} cid - IPFS CID
     * @returns {boolean}
     */
    has(cid) {
        return this.storage.has(cid);
    }

    /**
     * Get all stored CIDs
     * @returns {Array} Array of CIDs
     */
    getCIDs() {
        return Array.from(this.storage.keys());
    }

    /**
     * Get store statistics
     * @returns {Object} Store stats
     */
    getStats() {
        return {
            totalEntries: this.storage.size,
            totalSize: Array.from(this.storage.values()).reduce((sum, record) => sum + record.content.length, 0),
            oldestEntry: this.storage.size > 0 ? Array.from(this.storage.values())[0].metadata.storedAt : null,
            newestEntry: this.storage.size > 0 ? Array.from(this.storage.values())[this.storage.size - 1].metadata.storedAt : null
        };
    }

    /**
     * Clear store
     */
    clear() {
        this.storage.clear();
        this.log("🧹 Content store cleared", 'INFO');
    }
}

// Export singleton instance
const contentStore = new ContentStore();
export default contentStore;
