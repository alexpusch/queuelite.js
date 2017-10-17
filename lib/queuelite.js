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

  async publish(data, options) {
    options = Object.assign({ priority: 5 }, options);

    if (options.priority < 1 || options.priority > 9) {
      throw new Error(`options.priority has to be between 1 and 9`);
    }

    await this.storage.storeMessage(data, options);
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
    await this.consumeMessage(nextMessageId, nextMessage, handler);
    await this.storage.deleteClaimedMessage(nextMessageId);
    this.consumeNext(handler);
  }

  async consumeMessage(messageId, message, handler, tryCount = 0) {
    try {
      await handler(message, { tryCount });
    } catch (e) {
      if (e === Queuelite.ABORT) {
        await this.storage.moveMessageToAbortDir(messageId);
      } else {
        await this.consumeMessage(messageId, message, handler, tryCount + 1);
      }
    }
  }
}

Queuelite.ABORT = Symbol('queuelite abort');

module.exports = Queuelite;
