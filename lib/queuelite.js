const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const ON_DEATH = require('death');

const Storage = require('./storage');

class Queuelite {
  static async connect(dataDir) {
    const storage = new Storage(dataDir, process.pid);
    await storage.ensureDataDirs();
    return new Queuelite(storage);
  }

  constructor(storage) {
    this.storage = storage;
  }

  async publish(data) {
    await this.storage.storeMessage(data);
  }

  async consume(handler) {
    this.consumeNext(handler);

    ON_DEATH(() => {
      this.storage.destroy();
      process.exit(1);
    });
  }

  async consumeNext(handler) {
    const nextMessageId = await this.storage.getNextMessageId();
    const nextMessage = await this.storage.getClaimedMessage(nextMessageId);
    await this.consumeMessage(nextMessage, handler);
    await this.storage.deleteClaimedMessage(nextMessageId);
    this.consumeNext(handler);
  }

  async consumeMessage(message, handler, tryCount = 0) {
    try {
      await handler(message, { tryCount });
    } catch (e) {
      await this.consumeMessage(message, handler, tryCount + 1);
    }
  }
}

module.exports = Queuelite;
