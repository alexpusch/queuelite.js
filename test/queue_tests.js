const { expect } = require('chai');
const fs = require('fs-extra');

const Queuelite = require('../lib/queuelite');

const DATA_DIR = '/tmp/testDataDir';
const DATA = { val: 1 };
const DATA2 = { val: 2 };
const DATA3 = { val: 3 };
const DATA4 = { val: 4 };
const DATA5 = { val: 5 };
const DATA6 = { val: 6 };

function consumeAndAssert(q, assertionFns) {
  let counter = 0;

  return new Promise((resolve, reject) => {
    q.consume((message, metadata) => {
      let result;

      try {
        result = assertionFns[counter](message, metadata);
      } catch (e) {
        return reject(e);
      }

      counter += 1;

      if (counter >= assertionFns.length) return resolve();

      return result;
    });
  });
}

describe('queuelite', () => {
  beforeEach(async () => {
    await fs.remove(DATA_DIR);
  });

  describe('consume', async () => {
    it('works for publish before consume', async () => {
      const q = await Queuelite.connect(DATA_DIR);
      await q.publish(DATA);

      await consumeAndAssert(q, [msg => expect(msg).to.deep.equal(DATA)]);
    });

    it('works for publish after consume', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      const p = consumeAndAssert(q, [msg => expect(msg).to.deep.equal(DATA)]);

      await q.publish(DATA);

      return p;
    });

    it('consumes second message after first consume resolves', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      await q.publish(DATA);
      await q.publish(DATA2);

      await consumeAndAssert(q, [
        msg => expect(msg).to.deep.equal(DATA),
        msg => expect(msg).to.deep.equal(DATA2),
      ]);
    });

    it('consumes messages in order of priority and time', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      await q.publish(DATA5, { priority: 3 });
      await q.publish(DATA);
      await q.publish(DATA6, { priority: 6 });
      await q.publish(DATA2);
      await q.publish(DATA3, { priority: 1 });
      await q.publish(DATA, { priority: 9 });
      await q.publish(DATA4, { priority: 3 });
      await q.publish(DATA6, { priority: 4 });

      await consumeAndAssert(q, [
        msg => expect(msg).to.deep.equal(DATA3), // 1
        msg => expect(msg).to.deep.equal(DATA5), // 3
        msg => expect(msg).to.deep.equal(DATA4), // 3
        msg => expect(msg).to.deep.equal(DATA6), // 4
        msg => expect(msg).to.deep.equal(DATA), // 5
        msg => expect(msg).to.deep.equal(DATA2), // 5
        msg => expect(msg).to.deep.equal(DATA6), // 6
        msg => expect(msg).to.deep.equal(DATA), // 9
      ]);
    });

    it('consume first message again after first consume rejects', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      await q.publish(DATA);
      await q.publish(DATA2);

      await consumeAndAssert(q, [
        (msg) => {
          expect(msg).to.deep.equal(DATA);
          return Promise.reject();
        },
        msg => expect(msg).to.deep.equal(DATA),
        msg => expect(msg).to.deep.equal(DATA2),
      ]);
    });

    it('works for async consume handler', async () => {
      const q = await Queuelite.connect(DATA_DIR);
      await q.publish(DATA);
      await q.publish(DATA2);

      await consumeAndAssert(q, [
        msg =>
          new Promise(resolve =>
            setTimeout(() => {
              expect(msg).to.deep.equal(DATA);
              resolve();
            }, 10)),
        msg => expect(msg).to.deep.equal(DATA2),
      ]);
    });

    it('updates tryCount parameter after a message is rejected', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      await q.publish(DATA);
      await q.publish(DATA2);

      await consumeAndAssert(q, [
        (msg, metadata) => {
          expect(metadata.tryCount).to.deep.equal(0);
          return Promise.reject();
        },
        (msg, metadata) => expect(metadata.tryCount).to.deep.equal(1),
        (msg, metadata) => expect(metadata.tryCount).to.deep.equal(0),
      ]);
    });

    it('throws an error for an invalid priority', async () => {
      const q = await Queuelite.connect(DATA_DIR);
      let error;

      try {
        await q.publish(DATA, { priority: 99 });
      } catch (err) {
        error = err;
      }

      expect(error).to.be.an.instanceOf(Error);
    });

    it('aborts a message after reject with Queuelite.ABORT', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      await q.publish(DATA);
      await q.publish(DATA2);

      await consumeAndAssert(q, [
        (msg) => {
          expect(msg).to.deep.equal(DATA);
          return Promise.reject(Queuelite.ABORT);
        },
        msg => expect(msg).to.deep.equal(DATA2),
      ]);
    });
  });
});
