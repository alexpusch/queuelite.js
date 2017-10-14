const expect = require('chai').expect;
const fs = require('fs-extra');

const Queuelite = require('../lib/queuelite');

const DATA_DIR = '/tmp/testDataDir';
const DATA = { val: 1 };
const DATA2 = { val: 2 };

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

      counter++;

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
        msg => expect(msg).to.deep.equal(DATA2)
      ]);
    });

    it('consume first message again after first consume rejects', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      await q.publish(DATA);
      await q.publish(DATA2);

      await consumeAndAssert(q, [
        msg => {
          expect(msg).to.deep.equal(DATA);
          return Promise.reject();
        },
        msg => expect(msg).to.deep.equal(DATA),
        msg => expect(msg).to.deep.equal(DATA2)
      ]);
    });

    it('works for async consume handler', async () => {
      const q = await Queuelite.connect(DATA_DIR);
      await q.publish(DATA);
      await q.publish(DATA2);

      await consumeAndAssert(q, [
        msg =>
          new Promise((resolve, reject) =>
            setTimeout(() => {
              expect(msg).to.deep.equal(DATA);
              resolve();
            }, 10)
          ),
        msg => expect(msg).to.deep.equal(DATA2)
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
        (msg, metadata) => expect(metadata.tryCount).to.deep.equal(0)
      ]);
    });

    it('aborts a message after reject with Queuelite.ABORT', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      await q.publish(DATA);
      await q.publish(DATA2);

      await consumeAndAssert(q, [
        msg => {
          expect(msg).to.deep.equal(DATA);
          return Promise.reject(Queuelite.ABORT);
        },
        msg => expect(msg).to.deep.equal(DATA2)
      ]);
    });
  });
});
