const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');

const Storage = require('./storage');

class Queuelite {
  static async connect(dataDir) {
    const storage = new Storage(dataDir, process.pid);
    await storage.ensureDataDirs();
    return new Queuelite(storage);
  }

  constructor(storage) {
    this.storage = storage;
    this.incomingMessages = [];
  }

  async publish(data) {
    await this.storage.storeMessage(data);
  }

  consume(handler) {
    // consume all current pending messages
    this.storage.getAllMessageIds().then(existingMessageIds => {
      this.incomingMessages.push(...existingMessageIds);
      this.consumeNext(handler);
    });

    // consume newly arriving messages
    this.storage.addNewMessageListener(messageId => {
      const shouldStartConsuming = this.incomingMessages.length === 0;
      this.incomingMessages.push(messageId);
      if (shouldStartConsuming) this.consumeNext(handler);
    });

    const cleanupOnExit = () => this.storage.unclaimMesseges();

    //do something when app is closing
    process.on('exit', cleanupOnExit);

    //catches ctrl+c event
    process.on('SIGINT', cleanupOnExit);

    //catches uncaught exceptions
    process.on('uncaughtException', cleanupOnExit);
  }

  async consumeNext(handler) {
    if (this.incomingMessages.length === 0) return;

    const messageId = this.incomingMessages[0];

    const isClaimMessage = await this.storage.tryClaimMessage(messageId);

    if (isClaimMessage) {
      await this.consumeClaimedMessage(messageId, handler);
      this.incomingMessages.shift();

      await this.storage.deleteClaimedMessage(messageId);
      this.consumeNext(handler);
    } else {
      this.incomingMessages.shift();
      consumeNext(handler);
    }
  }

  async consumeClaimedMessage(messageId, handler) {
    const message = await this.storage.getClaimedMessage(messageId);

    return new Promise((resolve, promiseReject) => {
      const retry = () =>
        this.consumeClaimedMessage(messageId, handler).then(resolve);

      handler({ body: message, ack: resolve, retry, reject: resolve });
    });
  }
}

module.exports = Queuelite;
