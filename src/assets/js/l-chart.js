// Класс еденичной точки ограничения временного иетервала
let TimeLimit = (function () {
    const MILLISECOND_FACTOR = 1000;

    /*
    * Конструктор временного ограничения
    */
    function TimeLimit(milliseconsds) {
        this.milliseconsds = milliseconsds;
    }

    /*
    * Получаем секунды из милисекунд
    */
    TimeLimit.prototype.valueAsSeconds = function () {
        return Math.floor(this.milliseconsds / MILLISECOND_FACTOR);
    }

    /*
    * Получаем строку даты без ненужной таймзоны
    */
    TimeLimit.prototype.valueAsString = function () {
        let date = new Date(this.milliseconsds);
        let dateAsISOString = date.toISOString();
        let dateItems = dateAsISOString.split('.');
        return dateItems[0];
    }

    return TimeLimit;
})();

// Класс объекта временного интервала
let TimeInterval = (function () {
    
    function TimeInterval (startLimit, endLimit) {
        this.startLimit = new TimeLimit(startLimit);
        this.endLimit = new TimeLimit(endLimit);
    }

    TimeInterval.prototype.isLimitation = function () {
        return !!((this.endLimit.valueAsSeconds() - this.startLimit.valueAsSeconds()) < 30);
    }

    return TimeInterval;
})();

/*
* Нечто для выбора периода и вызова кода графика для обновления
*/
let TimeIntervalSelect = (function () {
    const INTERVAL_START_INPUT_CLASS = 'interval-start';
    const INTERVAL_END_INPUT_CLASS = 'interval-end';
    const INTERVAL_SELECT_BTN_CLASS = 'select-interval-btn';
    let onSelectCallback;
    let timeIntervalStart = 0;
    let timeIntervalEnd = 0;

    /*
    * Проверка временного интервала при его выборе
    */
    function onSelectInterval (event) {
        let intervalStartInput = document.getElementById(INTERVAL_START_INPUT_CLASS);
        let intervalEndInput = document.getElementById(INTERVAL_END_INPUT_CLASS);

        if (!intervalStartInput || !intervalEndInput) {
            console.error("One of the time limits is not available");
            return;
        }

        // Значения в милесекундах
        timeIntervalStart = intervalStartInput.valueAsNumber;
        timeIntervalEnd = intervalEndInput.valueAsNumber;

        if (!timeIntervalStart || !timeIntervalEnd) {
            alert("Выберите период.");
            return;
        } else if (timeIntervalStart >= timeIntervalEnd) {
            alert("Выбран не верный период.");
            return;
        }
        let timeInterval = new TimeInterval(timeIntervalStart, timeIntervalEnd);

        // Вызываем нечто на изменение периода
        onSelectCallback(timeInterval);
    }

    function TimeIntervalSelect (callback) {
        console.log('TimeIntervalSelect init');
        
        onSelectCallback = callback;
        const selectIntervalBtn = document.getElementById(INTERVAL_SELECT_BTN_CLASS);
        selectIntervalBtn.addEventListener('click', onSelectInterval);
    }

    return TimeIntervalSelect;
})();
// ...........................................................................................
// Временные ограничения блока данных для кэш
let LBlockLimits = (function () {

    function BlockLimits (startLimit, endLimit) {
        this.validateLimits(startLimit, endLimit);
        this.startLimit = startLimit;
        this.endLimit = endLimit;
    }

    // Частично валидируем границы
    BlockLimits.prototype.validateLimits = function (startLimit, endLimit) {
        if (startLimit >= endLimit) {
            throw new Error(`Error: startLimit >= endLimit - ${startLimit}, ${endLimit}`);
        } else if (startLimit <= 0) {
            throw new Error(`Error: startLimit <= 0 - ${startLimit}`);
        }
    }

    // Получаем ограничения блока данных левее текущих
    BlockLimits.prototype.getLeftBlockLimits = function () {
        return new BlockLimits(
            ((this.startLimit - (this.endLimit - this.startLimit)) - 1), 
            (this.startLimit - 1)
        );
    }

    // Получаем ограничения блока данных правее текущих
    BlockLimits.prototype.getRightBlockLimits = function () {
        return new BlockLimits(
            (this.endLimit + 1),
            ((this.endLimit + (this.endLimit - this.startLimit)) + 1)
        );
    }

    return BlockLimits;
})();

// Результат возвращаемый элементом кэш при запросе данных
let LCacheElementResult = (function () {

    function CacheElementResult () {
        this.dataset = [];
        this.blocksToLoad = [];
    }

    // Добавляем лимиты загружаемых блоков
    CacheElementResult.prototype.appendBlockToLoad = function (blockLimit) {
        this.blocksToLoad.push(blockLimit);
    }

    // Устанавливаем полный или частичный набор данных графика
    CacheElementResult.prototype.setDataset = function (dataset) {
        console.log('setDataset', dataset.length);
        this.dataset = dataset;
    }

    // Проверяем необходимость загрузки
    CacheElementResult.prototype.isLimits = function () {
        return !!this.blocksToLoad.length;
    }

    // Возвращаем копию лимитов для загрузки
    CacheElementResult.prototype.getLimits = function () {
        return this.blocksToLoad.slice();
    }

    return CacheElementResult;
})();

// Блок данных
let LCacheElementDataBlock = (function () {

    function CacheElementDataBlock (blockLimit, dataset) {
        this.blockLimit = blockLimit;
        this.dataset = dataset;
    }

    return CacheElementDataBlock;
})();

// Элемент кэш
let LCacheElement = (function () {

    function CacheElement (valueName, cacheId, startLimit, endLimit) {
        this.valueName = valueName;
        this.cacheId = cacheId;
        // От этих границ высчитываем границы других блоков данных
        this.startBlockLimits = new LBlockLimits(startLimit, endLimit);
        this.dataBlocks = [];
    }

    // Получение данных на основе временных ограничений
    CacheElement.prototype.getElementResult = function (reqStartLimit, reqEndLimit) {
        let result = new LCacheElementResult();

        if (!this.dataBlocks.length) { // Нет ни одного блока данных
            result.setDataset([]); // Данных нет
            let startBlockLimits = new LBlockLimits(reqStartLimit, reqEndLimit);
            result.appendBlockToLoad(startBlockLimits);
            result.appendBlockToLoad(startBlockLimits.getLeftBlockLimits());
            result.appendBlockToLoad(startBlockLimits.getRightBlockLimits());
            return result;
        }
        // Определяем блоки для границ запроса todo: Оформить по короче
        let reqBlocksLimits = []; // Требуемые границы блоков для данного запроса
        let leftBlock = this.dataBlocks[0]; // Крайний левый блок
        let rightBlock = this.dataBlocks[(this.dataBlocks.length - 1)]; // Крайний правый блок

        if (leftBlock.blockLimit.startLimit > reqStartLimit) { // Запрос выходит за левую границу
            // Подбираем левый блок двигаясь в лево от левого крайнего
            let newLimit = leftBlock.blockLimit.getLeftBlockLimits();
            while (newLimit.startLimit > reqStartLimit) {
                newLimit = newLimit.getLeftBlockLimits();
            }
            reqBlocksLimits.push(newLimit);
            if (newLimit.startLimit < reqStartLimit) {
                reqBlocksLimits.push(newLimit.getRightBlockLimits());
            }
        } else if (rightBlock.blockLimit.endLimit < reqStartLimit) { // Запрос выходит за правую границу
            // Подбираем левый блок двигаясь в право от правого крайнего
            let newLimit = rightBlock.blockLimit.getRightBlockLimits();
            while (newLimit.endLimit < reqEndLimit) { // !!! Возможно отсюда нужно будет переписать раздел else
                newLimit = newLimit.getRightBlockLimits();
            }
            if (newLimit.endLimit > reqEndLimit) {
                reqBlocksLimits.push(newLimit.getLeftBlockLimits());
            }
            reqBlocksLimits.push(newLimit);
        } else if (rightBlock.blockLimit.startLimit == reqStartLimit) {
            reqBlocksLimits.push(new LBlockLimits(reqStartLimit, reqEndLimit));
        } else if (rightBlock.blockLimit.startLimit < reqStartLimit) {
            reqBlocksLimits.push(new LBlockLimits(
                rightBlock.blockLimit.startLimit, 
                rightBlock.blockLimit.endLimit
            ));
        } else {
            let newLimit = rightBlock.blockLimit.getLeftBlockLimits();
            while (newLimit.startLimit > reqStartLimit) {
                newLimit = newLimit.getLeftBlockLimits();
            }
            reqBlocksLimits.push(newLimit);
            if (newLimit.startLimit < reqStartLimit) {
                reqBlocksLimits.push(newLimit.getRightBlockLimits());
            }
        }
        // Проверяем наличие блоков. Для имеющихся берем по фильтру данные, а отсутствующие добавляем в список
        let reqDataset = [];
        reqBlocksLimits.forEach((reqLimit) => {
            // Ищем блок по границе
            let block = this.findBlockByStartLimit(reqLimit.startLimit);
            if (block) { // Если есть, то формируем dataset
                if (block.dataset.length) {
                    let filteredDataset = block.dataset.filter((dataItem) => {
                        return (dataItem[0] >= reqStartLimit && dataItem[0] <= reqEndLimit); // Позиция даты времени в подмасиве 0
                    });
                    reqDataset = reqDataset.concat(filteredDataset);
                }
            } else { // Иначе добавляем в массив для загрузки
                result.appendBlockToLoad(reqLimit);
            }
        });
        result.setDataset(reqDataset);
        return result;
    }

    CacheElement.prototype.findBlockByStartLimit = function (startLimit) {
        return this.dataBlocks.find((block) => block.blockLimit.startLimit == startLimit);
    }

    // Добавление блока данных
    CacheElement.prototype.saveDataBlock = function (blockLimit, dataset) {
        let newDataBlock = new LCacheElementDataBlock (blockLimit, dataset);
        // todo: Добавить проверку на наличие блока???
        this.dataBlocks.push(newDataBlock);
        this.dataBlocks.sort((a, b) => a.blockLimit.startLimit - b.blockLimit.startLimit);
    }

    return CacheElement;
})();

let LCache = (function () {
    
    function Cache () {
        this.elements = [];
    }

    // Ищем элемент кэш
    Cache.prototype.findElement = function (valueName, cacheId) {
        console.log('LСache elements:', this.elements);
        return this.elements.find((element) => {
            return (element.valueName == valueName && element.cacheId == cacheId);
        });
    }

    // Добавляем элемент кэш
    Cache.prototype.appendElement = function (element) {
        this.elements.push(element);
    }

    Cache.prototype.clear = function () {
        this.elements = [];
    }

    // Обновляем элемент кэш
    Cache.prototype.updateElement = function (valueName, cacheId, startLimit, endLimit, dataset) {
        let index = this.elements.findIndex((element) => {
            return (element.valueName == valueName && element.cacheId == cacheId);
        });
        if (index < 0) {
            throw new Error(`Cache element not found. valueName: ${valueName}, cacheId: ${cacheId}`);
        }
        let blockLimit = new LBlockLimits(startLimit, endLimit);
        this.elements[index].saveDataBlock(blockLimit, dataset);
    }

    return Cache;
})();

// Запрос блока
let LBlockRequest = (function () {

    function BlockRequest (valueName, cacheId, blockLimits) {
        this.valueName = valueName;
        this.cacheId = cacheId;
        this.blockLimits = blockLimits;
    }

    return BlockRequest;
})();


// Объект загрузки данных с сервера
let LChartDataRepository = (function () {

    function DataRepository (url, imei) {
        this.URL = url;
        this.IMEI = imei;
        this.blocksRequests = [];
    }

    /*
    * Нужно, что бы привязать контекст для событий???
    */
    DataRepository.prototype.bindContext = function (context) {
        this.context = context;
    }

    DataRepository.prototype.loadBlocks = function (valueName, cacheId, blocksLimits) {
        blocksLimits.forEach((blockLimits) => {
            // Функция поиска
            let findRule = (bRequest) => { // !!! Дубль. Вынести
                return (bRequest.valueName == valueName
                && bRequest.cacheId == cacheId
                && bRequest.blockLimits.startLimit == blockLimits.startLimit);
            };
            // Ищем загружаемый блок
            let blockRequest = this.blocksRequests.find(findRule);
            if (blockRequest) { // Загрузка блока уже идет
                return;
            }
            // ---------------------------------------------------------------------
            this.processRequest(valueName, cacheId, blockLimits);
        });
    }
    
    DataRepository.prototype.startRequest = function (blockRequest) {
        let that = this;
        return new Promise(function (resolve, reject) {
            console.log('---= valueName =---', blockRequest.valueName);
            // -- Формируем URI запроса
            const target = new URL(that.URL);
            const params = new URLSearchParams();
            params.set('imei', that.IMEI);
            params.set('valueName', blockRequest.valueName);
            params.set('cacheId', blockRequest.cacheId);
            params.set('startLimit', blockRequest.blockLimits.startLimit);
            params.set('endLimit', blockRequest.blockLimits.endLimit);
            target.search = params.toString();
            // -- Отправляем запрос
            let xhr = new XMLHttpRequest();
            xhr.overrideMimeType("application/json");
            xhr.open('GET', target);
            xhr.onload = function () {
                if (this.status >= 200 && this.status < 300) {
                    console.log('Response!!!!!!!', JSON.parse(xhr.responseText));
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    console.log('Outch!!!!!!!');
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                }
            };
            xhr.onerror = function () {
                console.log('Outch!!!!!!!');
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            };
            xhr.send();
        });        
    }

    DataRepository.prototype.processRequest = function (valueName, cacheId, blockLimits) {
        let findRule = (bRequest) => { // !!! Дубль. Вынести
            return (bRequest.valueName == valueName
            && bRequest.cacheId == cacheId
            && bRequest.blockLimits.startLimit == blockLimits.startLimit);
        };
        // Создаем новый запрос блока данных и добавляем в список
        let newBlockRequest = new LBlockRequest(valueName, cacheId, blockLimits); // Создаем новый
        this.blocksRequests.push(newBlockRequest);
        // Запускаем запрос
        let request = this.startRequest(newBlockRequest);
        request.then((response) => {
            // Обработать возврат данных
            // Удаляем загруженный блок данных
            let index = this.blocksRequests.findIndex(findRule);
            if (index >= 0) {
                this.blocksRequests.splice(index, 1);
            }
            // Вызываем событие загрузки блока
            this.context.dispatch.call('onDataBlockLoaded', this.context, response);
        }).catch((e) => {
            // todo: Обработать ошибку!!!
            console.log('Error load data!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!', e)
            // Удаляем загруженный блок данных (Может при второй попытке повезет)
            let index = this.blocksRequests.findIndex(findRule);
            this.blocksRequests.splice(index, 1);
            // todo: Вызвать событие ошибки загрузки данных или продавить через 'onDataBlockLoaded'
        });
    }

    return DataRepository;
})();

// Объект отслеживающий текущее получение данных
let LLocalDataRequest = (function () {

    function LocalDataRequest (context) {
        this.context = context;
        this.limits = [];
        this.isProcessed = false; // Выполнен ли запрос с учетом загрузки данных
    }

    LocalDataRequest.prototype.process = function () {
        //console.log('----------');
        //console.log('cacheId', this.context.cacheId);
        //console.log('valueName', this.context.valueName);
        //console.log('currentTimeInterval.startLimit', this.context.currentTimeInterval.startLimit.valueAsSeconds());
        //console.log('currentTimeInterval.endLimit', this.context.currentTimeInterval.endLimit.valueAsSeconds());
        //console.log('----------');
        let cacheId = this.context.cacheId;
        let valueName = this.context.valueName;
        let reqStartLimit = this.context.currentTimeInterval.startLimit.valueAsSeconds();
        let reqEndLimit = this.context.currentTimeInterval.endLimit.valueAsSeconds();

        // Ищем элемент кэш
        let cacheElement = this.context.cache.findElement(
            valueName, 
            cacheId
        );
        
        if (!cacheElement) { // Элемент не найден
            console.log('cacheElement not found');
            // Создаем новый элемент кэш
            cacheElement = new LCacheElement (
                valueName, 
                cacheId, 
                reqStartLimit,
                reqEndLimit
            );
            // Добавляем элемент в кэш
            this.context.cache.appendElement(cacheElement);
        }
        // Получаем результат из кэш
        let result = cacheElement.getElementResult(reqStartLimit, reqEndLimit);

        if (!result.isLimits()) {
            console.log('onDataAvailable');
            this.context.dispatch.call('onDataAvailable', this.context, result.dataset);
            this.isProcessed = true;
        } else {
            console.log('onDataLoading');
            // Сохраняем список лимитов блоков локально
            this.limits = result.getLimits();
            this.context.dataRepository.loadBlocks(valueName, cacheId, result.getLimits());
            // Сообщаем, что требуется загрузка
            this.context.dispatch.call('onDataLoading', this.context, result.dataset);
        }
    }

    LocalDataRequest.prototype.onLoadBlock = function (data) {
        console.log('onLoadBlock', data);
        // Сохраняем любой полученный блок данных в кэш
        this.context.cache.updateElement(
            data.valueName, 
            data.cacheId,
            data.startLimit,
            data.endLimit,
            data.dataset
        );
        // Проверяем соотетсвие блока в списке и убираем, если он есть
        let index = this.limits.findIndex((blockLimits) => blockLimits.startLimit == data.startLimit);
        if (index >= 0) {
            this.limits.splice(index, 1);
        }
        // Проверяем, что список загрузок для запроса пуст
        if (!this.limits.length && !this.isProcessed) { 
            this.process();
        }
    }

    return LocalDataRequest;
})();
// ...........................................................................................
// -- Настройки отобржения времени
const formatMillisecond = d3.timeFormat(".%L"),
    formatSecond = d3.timeFormat(":%S"),
    formatMinute = d3.timeFormat("%H:%M"),
    formatHour = d3.timeFormat("%a %d %H"),
    formatDay = d3.timeFormat("%a %d"),
    formatWeek = d3.timeFormat("%b %d"),
    formatMonth = d3.timeFormat("%B"),
    formatYear = d3.timeFormat("%Y");

function multiFormat(date) {
    return (d3.utcSecond(date) < date ? formatMillisecond
        : d3.utcMinute(date) < date ? formatSecond
        : d3.utcHour(date) < date ? formatMinute
        : d3.utcDay(date) < date ? formatHour
        : d3.utcMonth(date) < date ? (d3.utcWeek(date) < date ? formatDay : formatWeek)
        : d3.utcYear(date) < date ? formatMonth
        : formatYear)(date);
}
// -- График
let LChart = (function () {
    const MIN_WIDTH = 800;
    const MIN_HEIGHT = 600;
    const SVG_NS = "http://www.w3.org/2000/svg";
    const SVG_VERSION = "1.1";
    const SVG_STYLE = "background-color:#ffffff;";
    const PADDING = 50; // Отсуп px со всех сторон графика
    
    // Индексы значений в массиве данных
    const INDEX_DATETIME = 0; // timestemp для значения
    const INDEX_VALUE = 1;    // Само значение
    
    // Минимальное и максимальное значения для оси y если данных нет
    const IF_EMPTY_MIN = -1;
    const IF_EMPTY_MAX = 1;

    // Константы для меню
    // --- Расчет положения иконок меню
    const MENU_MARGIN = 4;      // px Отступ иконки в каждой позиции
    const MENU_ICON_SIZE = 40;  // px Ширина (и высота) иконкт
    const MENU_ICONS_STEP = 50; // px
    // --- Действия пунктов меню
    const CHART_ACTION_CHANGE_MODE = 'CHART_ACTION_CHANGE_MODE'; // Действие изменения режима графика
    const CHART_ACTION_UNDO = 'CHART_ACTION_UNDO'; // Отмена изменения временного перида (Понадобится менять режим?)
    // --- Режимы обработки событий графика
    const CHART_MODE_TIME_PERIOD_SHIFT = 'CHART_MODE_TIME_PERIOD_SHIFT'; // Сдвиг временного периода
    const CHART_MODE_TIME_PERIOD_LIMITATION = 'CHART_MODE_TIME_PERIOD_LIMITATION'; // Ограничение временного периода
    const CHART_DEFAULT_MODE = CHART_MODE_TIME_PERIOD_SHIFT; // Режим поумолчанию

    // Функция парсинга строки даты и времени
    let parseTime = d3.timeParse("%Y-%m-%dT%H:%M:%S");
    let parseTime2 = d3.timeParse("%s");

    function secAsString (sec) {
        let date = new Date(sec * 1000);
        let dateAsISOString = date.toISOString();
        let dateItems = dateAsISOString.split('.');
        return dateItems[0];
    }

    // Вычисляем отношение секунд на пиксел
    function calculateSecondsPerPix(context) {
        // -- Сколько секунд помещается в ширину поля для сдвига 
        let secondsInterval = context.startTimeInterval.endLimit.valueAsSeconds() - context.startTimeInterval.startLimit.valueAsSeconds();
        // -- Сколько секунд приходится на один пискел ширины сдвига
        console.log('secondsInterval? Outch!', secondsInterval);
        context.cacheId = parseFloat(secondsInterval / context.concretChartWidth); // .toFixed(8)
        //context.secondsPerPix = Math.round(context.cacheId);
        context.secondsPerPix = context.cacheId;
    }
    
    /*
    * Вычисляем новый временной промежуток при сдвиге
    */
    function calculateNewTimeInterval(context, event) {
        // -- Разница между начальной и новой позицией
        let pixDiff = context.startOffsetX - event.offsetX; // При перетягивание вправо вижу более ранние значения, а потому минус
        // -- На сколько секунд произошел сдвиг
        let secondsDiff = Math.round(pixDiff * context.secondsPerPix);
        // -- Получаем новые границы
        let newStartLimit = Math.round(context.startTimeInterval.startLimit.valueAsSeconds() + secondsDiff) * 1000;
        let newEndLimit = Math.round(context.startTimeInterval.endLimit.valueAsSeconds() + secondsDiff) * 1000;
        let newTimeInterval = new TimeInterval(newStartLimit, newEndLimit);
        console.log('!!!!!!!!!!!!!!!!!!!!! 1', newTimeInterval);
        return newTimeInterval;
    }

    /*
    * Вычисляем новый времнной период при ограничении
    */
    function calculateNewTimeInterval2(context, event) {
        // Для получения временного интервала нужно посчитать от левой границы новую левую границу и через ширину - новую правую границу.
        let chartPeriodLimitation = context.svg.selectAll('.chart-period-limitation');
        let newStartLimit = context.startTimeInterval.startLimit.valueAsSeconds() - (PADDING * context.secondsPerPix) + parseInt(chartPeriodLimitation.attr('x'), 10) * context.secondsPerPix;
        let newEndLimit = newStartLimit + parseInt(chartPeriodLimitation.attr('width'), 10) * context.secondsPerPix;
        let newTimeInterval = new TimeInterval(newStartLimit * 1000, newEndLimit * 1000);
        console.log('!!!!!!!!!!!!!!!!!!!!! 2', newTimeInterval);
        return newTimeInterval;
    }

    /*
    * Инициализируем события взаимодействия с графиком
    * context - this объекта
    */
    function initEvents (context) {
        // Обработка действий пока только меню
        context.svg.selectAll('.chart-menu-icon').on('click', (event) => {
            const action = d3.select(event.target).attr('data-chart-acrtion');
            if (action == CHART_ACTION_CHANGE_MODE) { // Изменяем режим графика
                let newChartMode = d3.select(event.target).attr('data-chart-mode');
                if (context.chartMode == newChartMode) {
                    return;
                }
                context.chartMode = newChartMode;
                context.svg.selectAll('.chart-menu-icon').classed('selected', false);
                context.svg.selectAll(`.chart-menu-icon[data-chart-mode='${context.chartMode}']`).classed('selected', true);
            } else if (action == CHART_ACTION_UNDO) { // Отменяем действие
                console.log('action', CHART_ACTION_UNDO)
                if (!context.undoStack.length) { // Нет ничего для отката
                    return;
                }
                // Сохраняем предыдущее состояние
                let old = context.undoStack.pop(context.startTimeInterval);
                console.log('old', old);
                console.log('context.undoStack', context.undoStack);
                // ----------------------------------------------------------------------------
                // Вызваем событие с обновлением периода
                context.startTimeInterval = old;
                context.currentTimeInterval = old;
                context.dispatch.call('onProcessChart', context);
            }
        });

        // Нажимаем кнопку "мыши"
        context.svg.on('mousedown', (event) => {
            event.preventDefault();
            if (!event.target.classList.contains('chart-events')) {
                return;
            }
            console.log('mouseDown', event);
            context.isMouseDown = true;
            context.startOffsetX = event.offsetX;
            // Начинаем активность в зависимости от режима
            if (context.chartMode == CHART_MODE_TIME_PERIOD_SHIFT) {
                document.body.style.cursor = "grabbing";
            } else if (context.chartMode == CHART_MODE_TIME_PERIOD_LIMITATION) {
                document.body.style.cursor = "col-resize";
                // Отображаем облать ограничения временного периода
                context.svg.selectAll('.chart-period-limitation')
                    .attr('x', context.startOffsetX)
                    .attr('width', 1)
                    .attr('stroke-width', 0)
                    .attr('fill', '#000')
                    .style("opacity", 0.1);
            }
        });

        // Отпускаем кнопку "мыши"
        context.svg.on('mouseup', (event) => {
            event.preventDefault();
            if (!event.target.classList.contains('chart-events')) {
                return;
            }
            console.log('mouseUp', event);
            let newTimeInterval;
            if (context.chartMode == CHART_MODE_TIME_PERIOD_SHIFT) {
                newTimeInterval = calculateNewTimeInterval(context, event); // Вычисляем новые временные границы
                document.body.style.cursor = "grab"; // Меняем курсор
            } else if (context.chartMode == CHART_MODE_TIME_PERIOD_LIMITATION) {
                //  Получаем новый временной промежуток на основе ширины прямоугольника
                newTimeInterval = calculateNewTimeInterval2(context, event); // todo: Переименовать
                // Скрываем область 
                context.svg.selectAll('.chart-period-limitation')
                    .attr('x', 0)
                    .attr('width', 1)
                    .attr('fill', 'transparent');
                document.body.style.cursor = "auto"; // Меняем курсор
            }
            // ----------------------------------------------------------------------------
            // Это уже зачистка
            context.isMouseDown = false;
            context.startOffsetX = 0;
            console.log('??????????????', newTimeInterval.isLimitation());
            if (newTimeInterval.isLimitation()) {
                return;
            }
            // ----------------------------------------------------------------------------
            // Сохраняем предыдущее состояние
            context.undoStack.push(context.startTimeInterval);
            console.log('context.undoStack', context.undoStack);
            // ----------------------------------------------------------------------------
            // Вызваем событие с обновлением периода
            context.startTimeInterval = newTimeInterval;
            context.currentTimeInterval = newTimeInterval;
            context.dispatch.call('onProcessChart', context);
        });

        // Отпускание кнопки мыши вне svg
        window.addEventListener('mouseup', function(event){
            // todo: Немного запутанная история... Нужно разбираться
            if (!context.isMouseDown) { // Клавиша "мыши" нажата не в svg
                return;
            } else if (event.target.classList.contains('chart-events')) {
                return;
            }
            console.log('mouseUp', event);
            let newTimeInterval;
            if (context.chartMode == CHART_MODE_TIME_PERIOD_SHIFT) { // --- Завершили перетягивание
                newTimeInterval = calculateNewTimeInterval(context, event); // Вычисляем новые временные границы
                document.body.style.cursor = "auto"; // Меняем курсор
            } else if (context.chartMode == CHART_MODE_TIME_PERIOD_LIMITATION) { // --- Завершили выбор временной области
                // todo: Получить новый временной промежуток на основе ширины прямоугольника
                // Скрываем область 
                context.svg.selectAll('.chart-period-limitation')
                    .attr('x', 0)
                    .attr('width', 1)
                    .attr('fill', 'transparent');
                document.body.style.cursor = "auto"; // Меняем курсор
            }
            // ----------------------------------------------------------------------------
            // Это уже зачистка
            context.isMouseDown = false;
            context.startOffsetX = 0;
            // Сохраняем предыдущее состояние
            context.undoStack.push(context.startTimeInterval);
            console.log('context.undoStack', context.undoStack);
            // Вызваем событие с обновлением периода
            context.startTimeInterval = newTimeInterval;
            context.currentTimeInterval = newTimeInterval;
            context.dispatch.call('onProcessChart', context);
        });

        // Перемещаем курсор "мыши" (понадобится для плавности прокрути)
        context.svg.on('mousemove', (event) => {
            event.preventDefault();
            if (!context.isMouseDown) {
                return;
            } else if (!event.target.classList.contains('chart-events')) {
                return;
            }
            //console.log('mouseMove', event.offsetX);
            if (context.chartMode == CHART_MODE_TIME_PERIOD_SHIFT) { // --- Протяжка
                let newTimeInterval = calculateNewTimeInterval(context, event); // Вычисляем новые временные границы
                // Вызваем событие с обновлением периода
                context.currentTimeInterval = newTimeInterval;
                context.dispatch.call('onProcessChart', context); // todo: Нужно дать информацию, что данные брать только из кэша
            } else if (context.chartMode == CHART_MODE_TIME_PERIOD_LIMITATION) { // --- Уменьшение периода
                // Обновляем прямоугольник
                let chartPeriodLimitation = context.svg.selectAll('.chart-period-limitation');
                if (event.offsetX >= context.startOffsetX) {
                    chartPeriodLimitation.attr('width', Math.max(1, (event.offsetX - context.startOffsetX))); // Ширина минимум 1px
                } else {
                    chartPeriodLimitation.attr('x', event.offsetX)
                        .attr('width', (context.startOffsetX - event.offsetX));
                }
            }
        });

        // Курсор над нужным блоком
        context.svg.on('mouseover', (event) => {
            event.preventDefault();
            if (!event.target.classList.contains('chart-events')) {
                return;
            }
            // Изменяем курсор в зависимости от режима
            if (context.chartMode == CHART_MODE_TIME_PERIOD_SHIFT) {
                document.body.style.cursor = context.isMouseDown ? "grabbing" : "grab";
            } else if (context.chartMode == CHART_MODE_TIME_PERIOD_LIMITATION) {
                document.body.style.cursor = context.isMouseDown ? "col-resize" : "auto";
            }
        });

        // Курсор покинул блок
        context.svg.on('mouseout', (event) => {
            event.preventDefault();
            if (!event.target.classList.contains('chart-events')) {
                return;
            }
            // Вне зависимости от режима курсор за границами нас не интересует
            if (context.isMouseDown) {
                document.body.style.cursor = "not-allowed";
            } else {
                document.body.style.cursor = "auto";
            }
        });
    }

    /*
    * Рисуем меню
    */
    function drawMenu(context) {
        // --- Иконка выбора режима перетягивания
        let x = context.chartWidth - PADDING + (MENU_ICON_SIZE / 2) + MENU_MARGIN;
        let y = MENU_MARGIN;
        context.svg.append('rect')
            .classed('chart-menu-icon', true)
            .attr('data-chart-acrtion', CHART_ACTION_CHANGE_MODE) // Действие по иконке
            .attr('data-chart-mode', CHART_MODE_TIME_PERIOD_SHIFT) // Режим графика
            .attr('width', 28.30)  // todo: Вынести вычисление в код (Расчитано как катет равный другому катету от одной гипотенузы)
            .attr('height', 28.30) // todo: Вынести вычисление в код (Расчитано как катет равный другому катету от одной гипотенузы)
            .attr('fill', 'transparent')
            .attr('transform', `translate(${x}, ${y}) rotate(45) `)
            .append("svg:title").text('Сдвиг временного периода'); // todo: Вынести текст в константу

        // --- Иконка выбора режима масштабирования
        context.svg.append('rect')
            .classed('chart-menu-icon', true)
            .attr('data-chart-acrtion', CHART_ACTION_CHANGE_MODE) // Действие по иконке
            .attr('data-chart-mode', CHART_MODE_TIME_PERIOD_LIMITATION) // Режим графика
            .attr('x', context.chartWidth - PADDING + MENU_MARGIN)
            .attr('y', MENU_ICONS_STEP + MENU_MARGIN)
            .attr('width', MENU_ICON_SIZE)
            .attr('height', MENU_ICON_SIZE)
            .attr('fill', 'transparent')
            .append("svg:title").text('Ограничение временного периода'); // todo: Вынести текст в константу
        
        // --- Иконка отмены
        const RADIUS = MENU_ICON_SIZE / 2;
        context.svg.append('circle')
            .classed('chart-menu-icon', true)
            .attr('data-chart-acrtion', CHART_ACTION_UNDO) // Действие по иконке
            //.attr('class', 'chart-menu-undo-action') // Класс для элемента меню
            .attr('cx', context.chartWidth - PADDING + MENU_MARGIN + RADIUS) // Центр по оси X
            .attr('cy', (MENU_ICONS_STEP * 2) + MENU_MARGIN + RADIUS) // Центр по оси Y
            .attr('r', RADIUS) // Радиус.
            .attr('fill', 'transparent')
            .append("svg:title").text('Отмена действия');  // todo: Вынести текст в константу

        // --- Расцвечиваем иконку режима выбранного поумолчанию
        context.svg.selectAll(`.chart-menu-icon[data-chart-mode='${context.chartMode}']`).classed('selected', true);
    }

    /*
    * Рисуем график первый раз
    */
    function firstDraw(context, dataset, xScale, yScale) {
        console.log("firstDraw",context, dataset);

        // Создаем график
        context.svg = context.renderTo.append("svg")
            .attr("xmlns", SVG_NS)
            .attr("version", SVG_VERSION)
            .attr("dir", "ltr")
            .attr("style", SVG_STYLE)
            .attr("width", context.chartWidth)
            .attr("height", context.chartHeight)
            .attr("viewBox", `0 0 ${context.chartWidth} ${context.chartHeight}`);
        
        // Создаем ось X
        let xAxis = d3.axisBottom()
            .scale(xScale)
            .tickFormat(multiFormat);
            
        // Создаем ось Y
        let yAxis = d3.axisLeft()
            .scale(yScale);
    
        // Добавляем ось X в svg
        context.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + (context.chartHeight - PADDING) + ")")
            .call(xAxis);
               
        // Добавляем ось Y в svg
        context.svg.append("g")
            .attr("class", "y axis")
            .attr("transform", "translate(" + PADDING + ",0)")
            .call(yAxis);
    
        // Рисуем сам график
        context.svg.append("path")
            .attr("class", "chart-line")
            .datum(dataset)
            .attr("fill", "none")
            .attr("stroke", context.valueColor) // "steelblue"
            .attr("stroke-width", 1) // Ширина линии графика
            .attr("d", d3.line()
                //.x(function(d) { return xScale(parseTime(d[INDEX_DATETIME])) }) // parseTime заменить на парсинг UTC timestemp?
                .x(function(d) { return xScale(parseTime(d[INDEX_DATETIME])) })
                .y(function(d) { return yScale(d[INDEX_VALUE]) })
            );
            
        // Слой отображения ограничителя временного периода
        context.svg.append('rect')
            .classed('chart-period-limitation', true)
            .attr('x', 0)
            .attr('y', PADDING)
            .attr('width', 1)
            .attr('height', context.chartHeight - PADDING * 2)
            .attr('stroke-width', 0)
            .attr('fill', '#fff')
            .attr('fill', 'transparent');

        // Добавляем надпись загрузки (todo: Переделать для любых сообщений?)
        context.svg.append('text')
            .classed('chart-data-load', true)
            .attr("x", Math.floor(context.chartWidth / 2))
            .attr("y", Math.floor(context.chartHeight / 2))
            .text('Загрузка...')
            .attr('fill', 'transparent');


        // Слой для собыйтий графика
        context.svg.append('rect')
            .classed('chart-events', true)
            .attr('x', PADDING)
            .attr('y', PADDING)
            .attr('width', context.concretChartWidth)
            .attr('height', (context.chartHeight - PADDING * 2))
            .attr('stroke', 'none')
            .attr('fill', 'transparent');
        
        // -------------------------------------------------------------------------------
        drawMenu(context); // Добавляем меню
        initEvents(context); // Инициализируем обработку событий
    }

    // Обновляем элементы графика
    function updateDarw(context, dataset, xScale, yScale) {
        console.log("updateDraw", dataset.length);
        // Создаем ось X
        let xAxis = d3.axisBottom()
            .scale(xScale)
            .tickFormat(multiFormat);
            
        // Создаем ось Y
        let yAxis = d3.axisLeft()
            .scale(yScale);

        // Обновляем оси
        context.svg.selectAll("g.x.axis")
            .call(xAxis);
        
        context.svg.selectAll("g.y.axis")
            .call(yAxis);
       
        // Обновляем сам график!!!
        context.svg.selectAll(".chart-line")
            .datum(dataset)
            .attr("d", d3.line()
                .x(function(d) { return xScale(parseTime(secAsString(d[INDEX_DATETIME]))) })
                .y(function(d) { return yScale(d[INDEX_VALUE]) })
            );
    }

    // Получаем пропорции для осей
    function getScales(context, dataset) {
        // Создаем функции масштабирования по осям
		let xScale = d3.scaleTime()
		    .domain([
			    parseTime(context.currentTimeInterval.startLimit.valueAsString()),
				parseTime(context.currentTimeInterval.endLimit.valueAsString())
            ])
			.range([PADDING, context.chartWidth - PADDING]);
            //.nice(); // Получаем начальную и окончательную заcечки по x

        let domainMin = dataset.length ? d3.min(dataset, function(d) { return d[INDEX_VALUE]; }) : IF_EMPTY_MIN;
        let domainMax = dataset.length ? d3.max(dataset, function(d) { return d[INDEX_VALUE]; }) : IF_EMPTY_MAX;

        let yScale = d3.scaleLinear()
            .domain([
                domainMin, // Минимальное значение для графика
                domainMax  // Максимальное значение для графика
            ])
			.range([context.chartHeight - PADDING, PADDING]);

        return [xScale, yScale];
    }


    // Получаем данные и рисуем тут
    function onProcessChart () {
        let context = this;
        console.log('onProcessChart', arguments);
        console.log('currentTimeInterval', context.currentTimeInterval);
        // Получаем пропорции до данных
        calculateSecondsPerPix(context);

        this.currentLocalDataRequest = new LLocalDataRequest(context);
        this.currentLocalDataRequest.process();
    }

    function onDataAvailable(dataset) {
        let context = this;
        console.log('onDataAvailable:', dataset.length);
        // Скрываем отображение загрузки данных
        if (context.svg) {
            context.svg.selectAll('.chart-data-load').attr('fill', 'transparent');
        }
        // Обновляем график
        let [xScale, yScale] = getScales(context, dataset);

        // Рисуем
        if (!context.svg) { // Первый раз
            firstDraw(context, dataset, xScale, yScale);
        } else { // Обновляем график
            updateDarw(context, dataset, xScale, yScale);
        }
    }

    function onDataLoading(dataset) {
        let context = this;
        console.log('onDataLoading', arguments);
        // Обновляем график
        let [xScale, yScale] = getScales(context, dataset);
        // Рисуем
        if (!context.svg) { // Первый раз
            firstDraw(context, dataset, xScale, yScale);
        } else { // Обновляем график
            updateDarw(context, dataset, xScale, yScale);
        }
        // Отображаем загрузку данных
        context.svg.selectAll('.chart-data-load').attr('fill', 'blue').style("opacity", 1);
    }

    function onDataLoadingError() {
        let context = this;
        console.log('onDataLoadingError', arguments);
        // Скрываем отображение загрузки данных
        if (context.svg) {
            context.svg.selectAll('.chart-data-load').attr('fill', 'transparent');
        }
        // todo: Сообщить об ошибке (как текст загрузки?)

    }

    // Блок данных загружен
    function onDataBlockLoaded(dataset) {
        this.currentLocalDataRequest.onLoadBlock(dataset);
    }

    function LChart (elementId, dataRepository) {
        console.log('LChart create');
        // ---
        this.parentId = elementId; // id родителя
        this.renderTo = void 0; // элемент родителя
        this.parentWidth = void 0; // ширина родительского элемента
        this.parentHeight = void 0; // высота родительского элемента
        this.chartWidth = void 0; // ширина всего графика
        this.chartHeight = void 0; // высота всего графика
        this.concretChartWidth = 0; // Ширина только самого графика
        this.svg = void 0;
        // --- параметры временного интервала
        this.startTimeInterval = void 0; // Начальный интервал даты и времени (от него считаем новый)
        this.currentTimeInterval = void 0; // Промежуточный интервал даты и времени (его отображаем)
        // --- отношение числа секунд к пикселу ширины графика
        this.secondsPerPix = 0;
        // Работаем с режимами графика
        this.chartMode = CHART_DEFAULT_MODE; // Режим графика поумолчанию (в этой точке можно организовать изменения через параметры)
        // --- событийные параметры
        this.isMouseDown = false; // Нажата клавиша "мыши" (перетягивание/масштабирование)
        this.startOffsetX = 0; // Начальная точка смещения курсора "мыши" после нажатия
        // --- отмена
        this.undoStack = []; // Стек отмены
        // --- источник данных
        this.dataRepository = dataRepository;
        this.dataRepository.bindContext(this);
        // --- текущий запрос данных для отрисовки
        this.currentLocalDataRequest = new LLocalDataRequest(this);
        // --- Кэш
        this.cache = new LCache();
        this.cacheId = void 0;
        // --- Инициализация графика
        this.init();
    };

    /*
    * Инициализация графика
    */
    LChart.prototype.init = function () {
        console.log("Chart init");
        this.getParentElement();
        this.getChartSize();
        // Регистрируем пользовательское событие для создания/обновления графика
        this.dispatch = d3.dispatch(
            'onProcessChart', 
            'onDataAvailable', 
            'onDataLoading', 
            'onDataLoadingError',
            'onDataBlockLoaded'
        );
        // Функция вызываемая на создания/обновления графика
        this.dispatch.on('onProcessChart', onProcessChart);
        // Функция вызывается при наличии данных для графика
        this.dispatch.on('onDataAvailable', onDataAvailable);
        // Функция вызывается при загрузке данных для графика
        this.dispatch.on('onDataLoading', onDataLoading);
        // Функция вызывается при ошибке загрузке данных для графика
        this.dispatch.on('onDataLoadingError', onDataLoadingError);
        // Вызов на загрузку блока данных
        this.dispatch.on('onDataBlockLoaded', onDataBlockLoaded);
        // Ширина только области графика
        this.concretChartWidth = this.chartWidth - PADDING * 2;
    }

    /*
    * Получение родительского контейнера на основе id
    */
    LChart.prototype.getParentElement = function () {
        if (!this.parentId) { 
            throw new Error("Chart parent id not defined.");
        }
        
        this.renderTo = d3.select(`#${this.parentId}`); // Получаем родительский элемент
        if (this.renderTo.empty()) {
            throw new Error(
                `Chart parent with id '${this.parentId}' not found.`
            );
        }
    }

    /*
    * Пытаемся получить размеры всего графика на основе размеров родительского элемента
    */
    LChart.prototype.getChartSize = function () {
        this.parentWidth =  this.getElementWidth(this.renderTo);
        this.parentHeight = this.getElementHeight(this.renderTo);
        //console.log('Parent size:', this.parentWidth, this.parentHeight);

        this.chartWidth = Math.max(0, this.parentWidth || MIN_WIDTH);
        this.chartHeight = Math.max(0, (this.parentHeight > MIN_HEIGHT ? this.parentHeight : MIN_HEIGHT));
        //console.log('Chart size:', this.chartWidth, this.chartHeight);
    }

    /*
    * Получаем ширину выбранного d3 элемента
    */
    LChart.prototype.getElementWidth = function (d3Select) {
        let offsetWidth = Math.min(d3Select.node().offsetWidth, d3Select.node().scrollWidth);
        let boundingClientRectWidth = d3Select.node().getBoundingClientRect().width;
        if (boundingClientRectWidth < offsetWidth && boundingClientRectWidth >= offsetWidth - 1) {
            offsetWidth = Math.floor(boundingClientRectWidth);
        }
        return offsetWidth;
    }

    /*
    * Получаем высоту выбранного d3 элемента
    */
    LChart.prototype.getElementHeight = function (d3Select) {
        return Math.min(d3Select.node().offsetHeight, d3Select.node().scrollHeight);
    }

    /*
    * Получаем временной интервал для запроса данных и отрисовки графика
    */
    LChart.prototype.setTimeInterval = function (timeInterval, valueInfo) {
        let context = this;
        // Очищаем стек отмены
        context.undoStack = [];
        // Очищаем кэш
        context.cache.clear();
        // Устанавливаем временной интервал извне
        context.startTimeInterval = timeInterval;
        context.currentTimeInterval = timeInterval;
        // Сохраняем информацию о переменной
        context.valueName = valueInfo.name;
        context.valueColor = valueInfo.color;
        // Вызываю событие отрисовки/обновления графика
        context.dispatch.call('onProcessChart', context);
    }

    return LChart;
})();
