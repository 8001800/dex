<template>
  <v-layout fill-height class="chart-layout">
    <div v-show="!isLoading && !noData" id="chartdiv" class="chart-container">
    </div>
    <div v-show="!isLoading && noData" class="no-data-container">

      <div class="justify-content">
        <v-alert :value="true" :outline="true" type="info">
          No trade has happened for the pair {{ pairInfo.token }}/{{ pairInfo.base }} yet.
        </v-alert>
      </div>
      
    </div>
    <div v-show="isLoading" class="loading-container">
      <div class="justify-content">
        <v-progress-circular
          indeterminate
          color="red"
        ></v-progress-circular>
      </div>
    </div>
  </v-layout>
</template>

<script>
import { FETCH_OHLC_CHARTDATA } from '@/store/action-types'
import TOKENS from '@/core/tokens'
import BN from 'bn.js'
export default {
  name: 'PVChart',
  data () {
    return {
      isLoading: true,
      noData: false,
      chart: null,
      chartDataRef: []
    }
  },
  computed: {
    chartData: {
      get () {
        return this.$store.getters.chartData
      }
    },
    pairInfo: {
      get () {
        return this.$store.getters.pairInfo
      }
    }
  },
  watch: {
    chartData (newData) {
      this.chartDataRef.length = 0

      for (let i = 0; i < newData.length; i++) {
        this.chartDataRef[i] = newData[i]
      }

      this.isLoading = false
      this.noData = this.chartDataRef.length < 10
      if (this.noData) {
        return
      }

      if (this.chart == null) {
        this.initializeChart()
      }
      this.chart.validateData()
    }
  },
  methods: {
    initializeChart () {
      this.chart = AmCharts.makeChart("chartdiv", {
        type: "stock",
        theme: "black",
        //"color": "#fff",
        dataSets: [{
          title: "Token",
          fieldMappings: [ {
            fromField: "open",
            toField: "open"
          }, {
            fromField: "high",
            toField: "high"
          }, {
            fromField: "low",
            toField: "low"
          }, {
            fromField: "close",
            toField: "close"
          }, {
            fromField: "volume",
            toField: "volume"
          } ],
          compared: false,
          categoryField: "date",
          dataProvider: this.chartDataRef,
        } ],
        dataDateFormat: "YYYY-MM-DDTHH:mm:ss",

        panels: [ {
            title: "Price",
            percentHeight: 70,

            usePrefixes: true,
            prefixesOfSmallNumbers: [],
            numberFormatter: {
              precision: -1,
              decimalSeparator: '.',
              thousandsSeparator: '',
            },
            
            stockGraphs: [ {
              balloonText: "O:<b>[[open]]</b><br>H:<b>[[high]]</b><br>L:<b>[[low]]</b><br>C:<b>[[close]]</b>",
              type: "candlestick",
              id: "g1",
              openField: "open",
              closeField: "close",
              highField: "high",
              lowField: "low",
              valueField: "close",
              lineColor: "#0f0",
              fillColors: "#0f0",
              negativeLineColor: "#db4c3c",
              negativeFillColors: "#db4c3c",
              fillAlphas: 1,
              comparedGraphLineThickness: 2,
              columnWidth: 0.7,
              useDataSetColors: false,
              comparable: false,
              showBalloon: true,
              proCandlesticks: true,
            } ],
          },

          {
            title: "Volume",
            percentHeight: 30,
            marginTop: 1,
            columnWidth: 0.6,
            showCategoryAxis: false,

            usePrefixes: true,
            prefixesOfSmallNumbers: [],
            numberFormatter: {
              precision: -1,
              decimalSeparator: '.',
              thousandsSeparator: '',
            },

            stockGraphs: [ {
              valueField: "volume",
              openField: "open",
              type: "column",
              showBalloon: false,
              fillAlphas: 1,
              lineColor: "#099",
              fillColors: "#099",
              negativeLineColor: "#db4c3c",
              negativeFillColors: "#db4c3c",
              useDataSetColors: false
            }],

            stockLegend: {
              markerType: "none",
              markerSize: 0,
              labelText: "",
              periodValueTextRegular: "[[value.high]]"
            },

            valueAxes: [ {
              usePrefixes: true
            } ]
          }
        ],

        // panelsSettings: {
        //   plotAreaFillColors: "#333",
        //   plotAreaFillAlphas: 1,
        //   marginLeft: 40,
        //   marginRight: 5,
        //   marginTop: 5,
        //   marginBottom: 5
        // },

        chartScrollbarSettings: {
          graph: "g1",
          graphType: "line",
          usePeriod: "DD",
          backgroundColor: "#333",
          graphFillColor: "#666",
          graphFillAlpha: 0.5,
          gridColor: "#555",
          gridAlpha: 1,
          selectedBackgroundColor: "#444",
          selectedGraphFillAlpha: 1
        },

        categoryAxesSettings: {
          equalSpacing: true,
          gridColor: "#555",
          gridAlpha: 1
        },

        valueAxesSettings: {
          gridColor: "#555",
          gridAlpha: 1,
          inside: true,
          showLastLabel: true,
          precision: 6
        },

        chartCursorSettings: {
          pan: true,
          valueLineEnabled: true,
          valueLineBalloonEnabled: true
        },

        stockEventsSettings: {
          showAt: "high",
          type: "pin"
        },

        balloon: {
          textAlign: "left",
          offsetY: 10
        },

        // periodSelector: {
        //   position: "top",
        //   inputFieldsEnabled: false,
        //   periods: [ 
        //     // {
        //     //   period: "mm",
        //     //   count: 1,
        //     //   label: "1m"
        //     // },
        //     {
        //       period: "mm",
        //       count: 5,
        //       label: "5m"
        //     },
        //     {
        //       period: "mm",
        //       count: 15,
        //       label: "15m"
        //     },
        //     {
        //       period: "mm",
        //       count: 30,
        //       label: "30m"
        //     },
        //     {
        //       period: "hh",
        //       count: 1,
        //       label: "1h"
        //     },
        //     {
        //       period: "hh",
        //       count: 6,
        //       label: "6h"
        //     },
        //     {
        //       period: "hh",
        //       count: 12,
        //       label: "12h"
        //     },
        //     {
        //       period: "DD",
        //       count: 1,
        //       label: "1d"
        //     },
        //     {
        //       period: "WW",
        //       count: 1,
        //       label: "1w"
        //     },
        //     {
        //       period: "MM",
        //       count: 1,
        //       label: "1M"
        //     },
        //     {
        //       period: "MAX",
        //       count: 1,
        //       label: "MAX"
        //     }
        //   ]
        // }
      } );
    }
  },
}
</script>

<style lang="scss" scoped>
  .chart-layout {
    padding: 10px;
    .chart-container, .no-data-container, .loading-container {
      height: 100%;
      width: 100%;
    }
    .loading-container, .no-data-container {
      position: relative;
      > .justify-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate3d(-50%,-50%,0);
      }
    }
  }
</style>

<style lang="scss">
  .amChartsButton.amcharts-period-input, .amChartsButtonSelected.amcharts-period-input-selected {
    font-size: 0.8rem;
    padding: 1px 3px;
  }
</style>
