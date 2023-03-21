import got from 'got';
import moment from 'moment';

const days = 5;
let haveMore = true;
let batch = 0;
let params = {
    filter: 'eosio.evm:raw',
    after: moment
        .utc()
        .subtract(days, 'days')
        .format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'),
    limit: 1000,
    sort: 'asc',
};
let trxMap = {}
while (haveMore) {
    console.log(`Doing query with ${JSON.stringify(params)}`);
    const benchmarks = await got('http://fractal.teleology.one:7788/v2/history/get_actions', {
        searchParams: params,
    }).json();
    let acts = benchmarks.actions;
    let batchCount = acts.length;
    haveMore = params.limit === batchCount;
    console.log(
        `Batch ${++batch} had ${batchCount} actions and is at global_sequence ${
            params.global_sequence
        }`
    );
    let biggest = 0;
    for (let i = 0; i < acts.length; i++) {
        if (acts[i].global_sequence > biggest) {
            biggest = acts[i].global_sequence;
        }
        const action = acts[i];
        const producer = action.producer;
        const blockStr = action.block_num + '';
        if (!trxMap.hasOwnProperty(blockStr))
            trxMap[blockStr] = 1
        else
            trxMap[blockStr]++
    }
    params.global_sequence = `${biggest}-${Number.MAX_SAFE_INTEGER}`;
    if (params.after) {
        delete params.after;
    }
}

for (const block in trxMap) {
    console.log(`${block}: ${trxMap[block]}`)
}
