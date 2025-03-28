let $ = require("jquery");
const id = require("./vendor/moment/locale/id");
const da = require("./vendor/moment/locale/da");


$(document).ready(async function () {
  const page = $("[name='page']").attr("content");
  console.log(`starting up in page: ${page}`);
  if (page === 'exchange') {
    const worker = new ExchangeRatesWorker();
    await worker.start();

  } else if (page === 'energy') {
    const worker = new Energy();
    await worker.start();
  }
  $(".coming_soon").on('click', function () {
    UIkit.modal.alert('This feature is coming soon!');
  });
});



class Energy {

  constructor() {
    moment.locale('nb');
  }

  async start() {
    const areas = [
      {id: 'NO1', name: 'Øst'},
      {id: 'NO5', name: 'Vest'},
      {id: 'NO2', name: 'Sør'},
      {id: 'NO3', name: 'Midt'},
      {id: 'NO4', name: 'Nord'}
    ];

    for (const area of areas) {
      $("#main_grid").append(createEnergyCard(area.id, area.name))
      const data = await this.getRates(area.id);
      this.showResults(data, area.id);
    }

  }

  showResults(data, area) {
    const lowestHours = this.findBestHours(data, 4);
    const current = this.getCurrentHourData(data);
    const next = this.getNextHourData(data);

    // Find the record with the highest NOK_per_kWh
    const highest = data.reduce((max, record) => {
      return record.NOK_per_kWh > max.NOK_per_kWh ? record : max;
    }, data[0]); // Initialize with the first record


    // Find the record with the lowest NOK_per_kWh
    const lowest = data.reduce((min, record) => {
      return record.NOK_per_kWh < min.NOK_per_kWh ? record : min;
    }, data[0]); // Initialize with the first record


    const today = new moment(current.time_start).format('<b>dddd</b>, D MMMM YYYY');


    $(`#${area}_date`).html(`I dag ${today}`);
    $(`#${area}_hours`).html(current.hour_range);
    $(`#${area}_value`).html(current.price);
    $(`#${area}_hour_now`).html(current.hour_range);

    const footer = `
    Lav ${lowest.footer_price} (${lowest.hour_range})
    <br/>
    Høy ${highest.footer_price} (${highest.hour_range})
    <br/>
    Beste ladetidspunkt: <br/>
    ${this.createChargeHoursText(lowestHours)}
    `
    $(`#${area}_footer_info`).html(footer);
  }

  createChargeHoursText(data) {
    const items = data.map(item => {
      return {
        ...item,
        hour_range: `${formatTimeHHMM(new Date(item.time_start))}-${formatTimeHHMM(new Date(item.time_end))}`,  // Add the new property here
      };
    });

    let ret = [];
    for (const item of items) {
      ret.push(item.hour_range);
    }

    return ret.join('<br/>');
  }
  createValueText(current, force_ore = true, format_footer = false) {
    const price = current.NOK_per_kWh;
    let value;
    let value_vat;
    const vat = 1.25;
    if (price < 1 || force_ore) {
      //Let's show in øre
      value = `${(price * 100).toFixed(2)} øre/kWh`;
      value_vat = `${(price * 100 * vat).toFixed(2)} øre/kWh inkl. mva.`;
    } else {
      value = `${(price).toFixed(2)} kr/kWh`;
      value_vat = `${(price * vat).toFixed(2)} kr/kWh inkl. mva.`;
    }
    if (format_footer) {
      return `${(price * 100).toFixed(2)}`;
    }
    return `${value}<br/><span class="uk-text-small uk-text-muted">${value_vat}</span>`;
  }

  async getRates(area = 'NO1') {
    const date = getDateWithLeadingZeros(new Date());
    const url = `https://www.hvakosterstrommen.no/api/v1/prices/${date.year}/${date.month}-${date.day}_${area}.json`;
    const result = await getJSON(url);
    const data = this.parseResult(result)

    return data;
  }

  async parseResult(result) {
    return result.map(item => {
      return {
        ...item,
        hour_range: `${formatTimeHHMM(new Date(item.time_start))}-${formatTimeHHMM(new Date(item.time_end))}`,  // Add the new property here
        price: this.createValueText(item),
        footer_price: this.createValueText(item, true, true)
      };
    });
  }

  getCurrentHourData(data) {
    const now = new Date();
    const currentHour = now.getHours();

    for (const item of data) {
      const startTime = new Date(item.time_start);
      const startHour = startTime.getHours();

      if (startHour === currentHour) {
        return item; // Return the whole data object for the matching hour
      }
    }
    return null; // Return null if no match is found
  }

  getNextHourData(data) {
    const now = new Date();
    const nextHour = now.getHours() + 1; // Get the next hour (0-24)

    // Handle the case where the next hour is 24 (end of the day).  Rollover to 0.
    const nextHourAdjusted = nextHour % 24;

    for (const item of data) {
      const startTime = new Date(item.time_start);
      const startHour = startTime.getHours();

      if (startHour === nextHourAdjusted) {
        return item;
      }
    }
    return null;
  }

  findBestHours(data, hours) {
    // Sort the data by NOK_per_kWh in ascending order (lowest first).
    const sortedData = [...data].sort((a, b) => a.NOK_per_kWh - b.NOK_per_kWh);

    // Take the first 3 elements, which now represent the 3 lowest NOK_per_kWh values.
    const lowestHours = sortedData.slice(0, hours);

    // Sort the n lowest hours by time_start in ascending order.
    const sortedByTime = [...lowestHours].sort((a, b) =>
      a.time_start.localeCompare(b.time_start)
    );

    // Format the output to include the time_start and NOK_per_kWh.
    const result = sortedByTime.map(item => ({
      time_start: item.time_start,
      time_end: item.time_end,
      NOK_per_kWh: item.NOK_per_kWh
    }));
    return result;
  }

  findLowestNOKHours(data) {
    // Sort the data by NOK_per_kWh in ascending order (lowest first).
    const sortedData = [...data].sort((a, b) => a.NOK_per_kWh - b.NOK_per_kWh);

    // Take the first 3 elements, which now represent the 3 lowest NOK_per_kWh values.
    const lowestThreeHours = sortedData.slice(0, 3);


    // Sort the 3 lowest hours by time_start in ascending order.
    const sortedByTime = [...lowestThreeHours].sort((a, b) =>
      a.time_start.localeCompare(b.time_start)
    );

    // Format the output to include the time_start and NOK_per_kWh.
    const result = sortedByTime.map(item => ({
      time_start: item.time_start,
      NOK_per_kWh: item.NOK_per_kWh
    }));
    return result;
  }

}


class ExchangeRatesWorker {
  constructor() {
    moment.locale('en-gb')
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

    last_item.date = new moment(last_item.date).format('<b>dddd</b>, D MMMM YYYY');
    previous_item.date = new moment(previous_item.date).format('dddd, D MMMM YYYY');

    const trend = this.createTrendText(last_item, previous_item);
    if (last_item) {
      $(`#${symbol}_value`).html('NOK ' + last_item.rate);
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
    let change = ((now - then) / then * 100).toFixed(2);
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


class dataCache {
  /**
   *
   * @param area
   * @param client
   * @return array
   */
  static async getEnergyData(area, client) {
    const key = `energy_cache_${area}`;
    if (localStorage.getItem(key)) {
      return JSON.parse(localStorage.getItem("dataCache"));
    } else {
      const data = await client.getRates(area);
      localStorage.setItem(key, JSON.stringify(data));
      console.log(data,  'data')
      return data;
    }
  }
}

async function getJSON(url) {
  return fetch(url)
    .then((response) => response.json())
    .then((responseJson) => {
      return responseJson
    });
}

/**
 * Returns the year, month, and day with leading zeros.
 *
 * @param {Date} date - The date object. If not provided, the current date is used.
 * @returns {object} An object with `year`, `month`, and `day` properties (strings with leading zeros).  Returns null on invalid input.
 */
function getDateWithLeadingZeros(date = new Date()) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null; // Handle invalid date input
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, '0');

  return {year, month, day};
}

function formatTimeHHMM(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return null; // Handle invalid date input
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function createEnergyCard(id, name, data = null) {
  return `
  <div id="${id}">
      <div class="uk-card uk-card-default uk-card-body">
        <div class="uk-card-header">
          <div class="uk-card-badge uk-label">${name}</div>
          <div class="uk-width-expand">
            <div class="uk-grid-small uk-flex-middle" uk-grid>
              <p class="uk-text uk-margin-remove-top" id="${id}_date">
              </p>
            </div>
              <span class="uk-text uk-text-small" id="${id}_hours">10-11</span>

          </div>
        </div>
        <div class="uk-card-body">
<!--          <h5>Price now (<span id="NO1_hour_now">12:00-13:00</span>)</h5>-->
          <div class="energy_price" id="${id}_value">
            <div uk-spinner></div>
          </div>
<!--            <p class="uk-text uk-text-small uk-text-muted">Can we add here?</p>-->

<!--          <div class="trend-up exch_change" id="EUR_trend_text">-->
<!--            <p class="uk-text uk-text-small uk-text-muted">Can we add here?</p>-->
<!--          </div>-->
        </div>
        <div class="uk-card-footer">
          <p id="${id}_footer_info" class="uk-text uk-text-small">Her kommer info</p>
        </div>
      </div>
    </div>
  `;
}
