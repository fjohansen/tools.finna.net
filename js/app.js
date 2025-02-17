let $ = require("jquery");


$(document).ready(async function () {
  const worker = new ExchangeRatesWorker();
  await worker.start();
});

class ExchangeRatesWorker {
  constructor() {

  }

  async start() {
    const symbols = ['EUR', 'USD', 'GBP'];
    for (const symbol of symbols) {
      const data = await this.getRates(symbol);
      this.showResults(data, symbol);
    }
  }

  /**
   * Show the results from Norges Bank
   * @param data
   * @param symbol
   */
  showResults(data, symbol) {
    const last_item = data[data.length - 1];
    const previous_item = data[data.length - 2];

    const trend = this.createTrendText(last_item, previous_item);
    if (last_item) {
      $(`#${symbol}_value`).html('NOK ' + last_item.rate );
      // $(`#${symbol}_value`).html(`NOK ${last_item.rate} (${previous_item.rate})`);
      // $(`#${symbol}_value`).html(`NOK ${last_item.rate}`);
      $(`#${symbol}_date`).html(`Exchange date: ${last_item.date}`);
      $(`#${symbol}_trend_text`).html(trend);
    }
  }

  createTrendText(item, prev_item) {
    const now = parseFloat(item.rate);
    const then = parseFloat(prev_item.rate);

    let change = ((now-then)/then * 100).toFixed(2);

    if (parseFloat(change) > 0) {
      return `UP ${change}% since ${prev_item.date}`;
    } else {
      return `DOWN ${change}% since ${prev_item.date}`;
    }
  }

  async parseResult(result) {
    let dates = [];
    const observations = result.data.structure.dimensions.observation[0].values;
    observations.forEach(function (item, index) {
      // console.log(item, index);
      let value = result.data.dataSets[0].series['0:0:0:0'].observations[index][0];
      value = parseFloat(value).toFixed(3)
      const data = {date: item.name, rate: value};
      dates.push(data);
    });

    return dates;

  }

  /**
   * Get last n days of observations from Norges Bank for given symbol
   * @param symbol
   * @returns {Promise<*[]>}
   */
  async getRates(symbol, n = 7) {
    const url = `https://data.norges-bank.no/api/data/EXR/B.${symbol}.NOK.SP?format=sdmx-json&lastNObservations=${n}&locale=en`;
    const result = await getJSON(url);
    return await this.parseResult(result);
  }
}


async function getJSON(url) {
  return fetch(url)
    .then((response) => response.json())
    .then((responseJson) => {
      return responseJson
    });
}
