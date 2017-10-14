const expect = require('chai').expect;
const Promise = require('bluebird');
const fs = require('fs-extra');
const path = require('path');

const Queuelite = require('../lib/queuelite');

const DATA_DIR = '/tmp/testDataDir';
const DATA = { val: 1 };
const DATA2 = { val: 2 };
const DATA3 = { val: 3, _priority: 1 };
const DATA4 = { val: 4, _priority: 3 };
const DATA5 = { val: 5, _priority: 3 };
const DATA6 = { val: 5, _priority: 60 };

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
      q.publish(DATA);

      await consumeAndAssert(q, [msg => expect(msg).to.deep.equal(DATA)]);
    });

    it('works for publish after consume', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      const p = consumeAndAssert(q, [msg => expect(msg).to.deep.equal(DATA)]);

      q.publish(DATA);

      return p;
    });

    it('consumes second message after first consume resolves', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      let count = 0;

      q.publish(DATA);
      q.publish(DATA2);

      await consumeAndAssert(q, [
        msg => expect(msg).to.deep.equal(DATA),
        msg => expect(msg).to.deep.equal(DATA2)
      ]);
    });

    it('consumes messages in order of priority and time', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      await q.publish(DATA4); // priority 3 -> 2nd
      await q.publish(DATA); // priority not set, defaults to 50 -> 4th
      await q.publish(DATA6); // priority 60 -> 6th
      await q.publish(DATA2); // priority not set, defaults to 50 -> 5th
      await q.publish(DATA3); // priority 1 -> 1st
      await q.publish(DATA5); // priority 3 -> 3rd

      await consumeAndAssert(q, [
        msg => expect(msg).to.deep.equal(DATA3),
        msg => expect(msg).to.deep.equal(DATA4),
        msg => expect(msg).to.deep.equal(DATA5),
        msg => expect(msg).to.deep.equal(DATA),
        msg => expect(msg).to.deep.equal(DATA2),
        msg => expect(msg).to.deep.equal(DATA6)
      ]);
    });

    it('consume first message again after first consume rejects', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      let count = 0;

      q.publish(DATA);
      q.publish(DATA2);

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
      q.publish(DATA);
      q.publish(DATA2);

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

    it('updates tryCount paramter after a message is rejected', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      q.publish(DATA);
      q.publish(DATA2);

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

      q.publish(DATA);
      q.publish(DATA2);

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
