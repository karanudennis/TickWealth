/**
 * ⚡ TICKWEALTH VANGUARD NEXUS - Canvas Graphics View Pipeline
 * Module: vanguard-view.js
 * Hardware-accelerated TradingView Lightweight Charts canvas wrapper.
 * Strictly adheres to institutional dark palette, thread-safe monotonic ticks,
 * responsive resize tracking, and execution marker rendering loops.
 */

(function (window) {
  'use strict';

  let vanguard_chart_instance = null;
  let vanguard_area_series = null;
  let vanguard_last_pushed_timestamp = 0;
  let vanguard_is_initialized = false;
  let vanguard_container_element = null;
  let vanguard_resize_observer = null;
  let vanguard_current_symbol = 'R_100';

  /**
   * Initializes the TradingView Lightweight Chart canvas inside chart-div container.
   * Palette: Background #0b0f17, Borders #1c2536, Accent Blue #2979ff.
   * @param {string} vanguard_container_id - DOM ID of the container element (chart-div).
   */
  function vanguard_init_chart(vanguard_container_id = 'chart-div') {
    vanguard_container_element = document.getElementById(vanguard_container_id);
    if (!vanguard_container_element) {
      console.warn(`[Vanguard View] Element #${vanguard_container_id} not yet located.`);
      return false;
    }

    if (typeof window.LightweightCharts === 'undefined') {
      setTimeout(() => vanguard_init_chart(vanguard_container_id), 150);
      return false;
    }

    if (vanguard_chart_instance) {
      try {
        if (vanguard_resize_observer) vanguard_resize_observer.disconnect();
        vanguard_chart_instance.remove();
      } catch (err) {
        console.warn('[Vanguard View] Disposal warning:', err);
      }
      vanguard_chart_instance = null;
      vanguard_area_series = null;
    }

    const vanguard_width = vanguard_container_element.clientWidth || 800;
    const vanguard_height = 420;

    vanguard_chart_instance = window.LightweightCharts.createChart(vanguard_container_element, {
      width: vanguard_width,
      height: vanguard_height,
      layout: {
        background: {
          type: 'solid',
          color: '#0b0f17',
        },
        textColor: '#70839a',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: {
          color: 'rgba(28, 37, 54, 0.45)',
          style: 1, // Dotted
        },
        horzLines: {
          color: 'rgba(28, 37, 54, 0.45)',
          style: 1,
        },
      },
      crosshair: {
        mode: window.LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: '#2979ff',
          width: 1,
          style: 3,
          labelBackgroundColor: '#162030',
        },
        horzLine: {
          color: '#2979ff',
          width: 1,
          style: 3,
          labelBackgroundColor: '#162030',
        },
      },
      timeScale: {
        borderColor: '#1c2536',
        timeVisible: true,
        secondsVisible: true,
        barSpacing: 7,
        rightOffset: 8,
      },
      rightPriceScale: {
        borderColor: '#1c2536',
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
        autoScale: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    vanguard_area_series = vanguard_chart_instance.addAreaSeries({
      topColor: 'rgba(41, 121, 255, 0.35)',
      bottomColor: 'rgba(41, 121, 255, 0.01)',
      lineColor: '#2979ff',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: vanguard_current_symbol === 'frxEURUSD' ? 5 : 2,
        minMove: vanguard_current_symbol === 'frxEURUSD' ? 0.00001 : 0.01,
      },
    });

    vanguard_last_pushed_timestamp = 0;
    vanguard_is_initialized = true;

    // Automated Window Resize tracking function without layout stutter
    vanguard_resize_observer = new ResizeObserver((vanguard_entries) => {
      if (!vanguard_entries || vanguard_entries.length === 0 || !vanguard_chart_instance) return;
      const vanguard_entry = vanguard_entries[0];
      const vanguard_new_width = vanguard_entry.contentRect.width;
      if (vanguard_new_width > 0) {
        vanguard_chart_instance.applyOptions({
          width: vanguard_new_width,
          height: 420,
        });
      }
    });

    vanguard_resize_observer.observe(vanguard_container_element);

    window.addEventListener('resize', () => {
      if (vanguard_chart_instance && vanguard_container_element) {
        vanguard_chart_instance.applyOptions({
          width: vanguard_container_element.clientWidth,
          height: 420,
        });
      }
    });

    return true;
  }

  /**
   * Thread-safe update function to push price quotes onto the canvas layer.
   * Guarantees strictly monotonic time values for lightweight-charts.
   */
  function pushPriceToChart(epochTimestamp, livePrice) {
    if (!vanguard_area_series || !vanguard_chart_instance) {
      if (!vanguard_is_initialized) {
        vanguard_init_chart('chart-div');
      }
      if (!vanguard_area_series) return;
    }

    const vanguard_num = parseFloat(livePrice);
    if (isNaN(vanguard_num)) return;

    let vanguard_ts = Math.floor(Number(epochTimestamp) || Date.now() / 1000);

    if (vanguard_ts <= vanguard_last_pushed_timestamp) {
      vanguard_ts = vanguard_last_pushed_timestamp + 1;
    }
    vanguard_last_pushed_timestamp = vanguard_ts;

    try {
      vanguard_area_series.update({
        time: vanguard_ts,
        value: vanguard_num,
      });
    } catch (err) {
      console.warn('[Vanguard View] Canvas push warning:', err.message);
    }
  }

  /**
   * Renders visual markers on the chart for trade executions.
   */
  function addExecutionMarker(timestamp, contractType, price, note = '') {
    if (!vanguard_area_series) return;

    const vanguard_is_bullish = ['CALL', 'RISE', 'DIGITEVEN', 'DIGITOVER'].includes(contractType.toUpperCase());
    const vanguard_is_call = contractType.toUpperCase().includes('CALL') || contractType.toUpperCase().includes('RISE');

    const vanguard_marker = {
      time: Math.floor(timestamp) || Math.floor(Date.now() / 1000),
      position: vanguard_is_bullish ? 'belowBar' : 'aboveBar',
      color: vanguard_is_bullish ? '#00e676' : '#ff1744',
      shape: vanguard_is_call ? 'arrowUp' : (vanguard_is_bullish ? 'circle' : 'arrowDown'),
      text: `${contractType} @ ${Number(price).toFixed(2)} ${note}`,
      size: 1.5,
    };

    try {
      const vanguard_existing = (vanguard_area_series.markers && vanguard_area_series.markers()) || [];
      const vanguard_updated = [...vanguard_existing, vanguard_marker].slice(-50);
      vanguard_area_series.setMarkers(vanguard_updated);
    } catch (e) {
      console.warn('[Vanguard View] Marker render warning:', e);
    }
  }

  function resetChartData() {
    if (vanguard_area_series) {
      try {
        vanguard_area_series.setData([]);
        if (typeof vanguard_area_series.setMarkers === 'function') {
          vanguard_area_series.setMarkers([]);
        }
      } catch (e) {
        console.warn('[Vanguard View] Reset warning:', e);
      }
    }
    vanguard_last_pushed_timestamp = 0;
  }

  function setChartSymbol(vanguard_symbol) {
    vanguard_current_symbol = vanguard_symbol;
    if (!vanguard_area_series) return;

    let vanguard_precision = 2;
    let vanguard_min_move = 0.01;

    if (vanguard_symbol === 'frxEURUSD') {
      vanguard_precision = 5;
      vanguard_min_move = 0.00001;
    } else if (vanguard_symbol === '1HZ75V' || vanguard_symbol === 'R_100') {
      vanguard_precision = 2;
      vanguard_min_move = 0.01;
    }

    try {
      vanguard_area_series.applyOptions({
        priceFormat: {
          type: 'price',
          precision: vanguard_precision,
          minMove: vanguard_min_move,
        },
      });
    } catch (err) {
      console.warn('[Vanguard View] Precision config warning:', err);
    }
  }

  window.VanguardView = {
    initChart: vanguard_init_chart,
    pushPriceToChart,
    addExecutionMarker,
    resetChartData,
    setChartSymbol,
  };

  window.pushPriceToChart = pushPriceToChart;
  window.initTradingChart = vanguard_init_chart;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => vanguard_init_chart('chart-div'));
  } else {
    setTimeout(() => vanguard_init_chart('chart-div'), 100);
  }
})(window);
