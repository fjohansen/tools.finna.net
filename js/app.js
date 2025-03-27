let $ = require("jquery");


$(document).ready(async function () {
  const page = $("[name='page']").attr("content");
  console.log(`starting up in page: ${page}`);
  if (page === 'exchange') {
    const worker = new ExchangeRatesWorker();
    await worker.start();
  }
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
    let last_item = data[data.length - 1];
    let previous_item = data[data.length - 2];
    const first_item = data[0];
    moment.locale('en-gb');
    last_item.date = new moment(last_item.date).format('<b>dddd</b>, D MMMM YYYY');
    previous_item.date = new moment(previous_item.date).format('dddd, D MMMM YYYY');

    const trend = this.createTrendText(last_item, previous_item);
    if (last_item) {
      $(`#${symbol}_value`).html('NOK ' + last_item.rate );
      // $(`#${symbol}_value`).html(`NOK ${last_item.rate} (${previous_item.rate})`);
      // $(`#${symbol}_value`).html(`NOK ${last_item.rate}`);
      $(`#${symbol}_date`).html(`${last_item.date}`);
      $(`#${symbol}_trend_text`).html(trend);
    }
  }

  createTrendText(item, prev_item) {
    const now = parseFloat(item.rate);
    const then = parseFloat(prev_item.rate);

    // let change = parseFloat(((now-then)/then * 100).toFixed(2));
    let change = ((now-then)/then * 100).toFixed(2);
    let text;
    switch (Math.sign(parseFloat(change))) {
      case 1:
        text = `UP ${change}% since ${prev_item.date}`;
        break;
      case -1:
        text = `DOWN ${change}% since ${prev_item.date}`;
        break;
      default:
        text = `UNCHANGED ${change}% since ${prev_item.date}`;
    }

    return text;
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
