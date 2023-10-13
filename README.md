# Грфики

## Используемая струкутра данных

Данные получаются HTTP GET запросом. Передаваемые серверу парметры запроса (все обязательные):

- `imei` - (строка) imei устройства для параметра которого выполняется запрос.
- `valueName` - (строка) имя параметра для которого запрашиваются данные.
- `startLimit` - (целое число) минимальное количество секунд для даты и времени (UTC timestemp) ограничевающее временной период, 
но без учета временного пояса. Точнее временной пояс сответсвует временному поясу в котором работает браузер.
- `endLimit`  - (целое число) максимальное количество секунд для даты и времени (UTC timestemp) ограничевающее временной период, 
но без учета временного пояса. Точнее временной пояс сответсвует временному поясу в котором работает браузер.
- `cacheId` - (число с плавающей точкой) является и идентификатором данных в кэше и числом секунд на пиксел для ширины текущего графика.
Предполагается, что данные собираются не чаще чем раз в секунду. Значение можно округлить для разбивки общего временного промежутка 
(от `startLimit` до `endLimit` включительно) на временные промежутки соответсвующие каждому пикселу. Если округленное число меньше или 
равно 1 (на пиксел одно или менее значений), значит величины параметра можно отдавать как есть, без определения минимума и максимума на пиксел.

Значения `startLimit` и `endLimit` задают рамки кэшируемого блока и привязаны к `cacheId`. Параметр `valueName` указывает параметр, 
для которого запрашиваются данные, а `imei` - это устройство параметра.

В твете ожидается JSON структура следующего вида (все ключи и их значения обязательные):

```json
{
    'valueName': ..,
    'cacheId': ..,
    'startLimit': ..,
    'endLimit': ..,
    'dataset': [..,],
}
```

По ключам `valueName`, `cacheId`, `startLimit`, `endLimit` ожидаются значения переданые в запросе с сохранением типа. 
Это требуется для правильной работы кэша.

По ключу `dataset` значение является массивом массивов данных. Каждый массив данных содержит целое значение в секундах по индексу 0 и 
значение параметра в флоат по индексу 1, например, `[[1694604719, 1.1], [1694604720, 10.9], [1694604720, 3.7],.. ]`.
Так же это может быть пустой массив, если данных нет. Массивы данных __отсортированы__ по значению индекса 0 (по времени от меньшего к большему).

## Описание файлов стилей

`/css/styles.css` - общий фаил стилей для всей страницы.

`/css/time-interval-select.css` - файл стилей для области выбора временного периода.

`/css/i-chart.css` - файл стилей используемых в графике.

## Описание работы JS скрипта

В разработке скрипта графика использовался билиотека [D3.js](https://d3js.org/). Она ориентирована как и JQuery на работу со страницей браузера, но
расширена для работы с SVG и математикой геометрических преобразований (в частности, для построения графиков на низком уровне).
[Хранилище](https://github.com/d3/d3) исходного кода. [Документация](https://d3js.org/getting-started).
[Примеры](https://observablehq.com/@d3/gallery).

Для разработки кода использовался вариант библиотеки без сжатия `/js/d3/d3.js`. Можно его заменить на сжатую версию `/js/d3/d3.min.js`.

Единственный файл скрипта `/js/l-chart.js` содержит весь код. Он состоит из двух частей:

- кода для выбора временного периода графика (может быть доработан для выбора имен параметров, цвета графиков и прочего);
- кода самого графика, объекта запроса данных и объектов связанных с кэшем.

Для выбора временного периода используется стандартный браузерный компонент: `<input type="datetime-local" />`. 
У него есть некоторые различия в разных браузерах, например, необходимость принудительной установки времени. 
В браузере Google Chrome время выставляется по умолчанию текущее, а Firefox требует дополнительных манипуляций.
На "яблочном" браузере проверить не могу. Написание своего компонента пока не разумно, так как все одно
потребует тесты в других браузерах.

Создание графика состоит из создания его объекта и передачи в него временных ограничений с именем переменной и цветом её отображения.

При создании объекта графика в него передается идентификатор элемента страницы в который он встраивается и объекта хранилища данных.
Объект хранилища данных привязан к URL запроса и imei устройтсва, что позволяет при использовании нескольких объектов хранилища для разных графиков
привязать их к разным устройствам.

Объект графика через метод `setTimeInterval` принимает объект временного периода и простой объект с именем параметра и цветом линии графика.
Пример:

```javascript

    const DATA_URL = 'http://localhost:8084'; // URL запроса данных
    const IMEI = '1234567'; // imei устройства

    let dataReposytory = new LChartDataRepository(DATA_URL, IMEI); // источник данных
    let lChart; // Используем один график

    // Создаем селектор временного периода для графика 
    const timeIntervalSelect = new TimeIntervalSelect(function (timeInterval) { // вызов после выбора временного периода
        // Здесь задаем код для создания/обновления одного или более графиков
        if (!lChart) { // График не задан
            lChart = new LChart("chart-container", dataReposytory);
        }
        lChart.setTimeInterval(
            timeInterval,                  // Первоначальный временной интервал 
            {name: 'value1', color: 'green'} // Имя переменной и цвет графика. Можно задать динамически.
        );
    });
```

Рисовать что либо имеет смысл только после выбора/изменения временного периода и задания параметра.
Изначально график рисуется пустым, но с осями, соответсвующими временному периоду (x), и значениям (y). 
На правой стороне графика доступно меню из трех геометрических фигур (можно будет заменить на иконки).
Ромб (как стрелки влево и вправо), выбран по умолчанию, позволяет перетягивать график влево и вправо.
Квадрат (как вертикальная область выбора), позволяет переключиться в режим уменьшения временного периода.
Окружность при клике возвращает в позицию предыдущего временного периода. 
После нескольких нажатий можно вернуться к первоначально выбранному.

При установке нового временного периода запрашивается стартовый блок данных и два соседних.
При прокрутке загружается нужный крайний блок.
При возвратах используются уже подгруженные данные.
Возможные доработки: 

- опережающий запуск загрузки крайних блоко при начале протягивания;
- для правой границы перезагрузка блоков, для которых могли быть только что загружены данные.

Но это все сильно зависит от бэкенда.

Кэширование упирается в произвольность выбора временного периода.
Эта же особенность не позволяет менять ширину графика при динамическом изменении размеров окна браузера.

Так же бэкенд должен учитывать частоту загрузки данных, так как текущее решение основано на посекудной загрузке.
Тесты показали, что при запросе данных согласно пропорций основное время уходит на формированиее данных на бэкенде
в режиме для каждого пиксела (большие временные периоды: неделя, месяц, год). Сама отрисовка осуществляется быстро
на основе отфильтрованных данных из закэшированных блоков.
При протяжке скрипт просто фильтрует по здвинутому временному периоду данные из двух соседних блоков и рисует.
Загружать для каждого сдвига не рентабельно. Данные долго выбираются повторно по пересечению и возникает эффект
"танца" графика (график как бы динамически ломается). Это связано с тем, что минимальные и максимальные значения 
для новых промежутков другие.

## Описание работы Python скриптов

Бэкенд для тестов написан на python с использованием фреймвока `sanic`.
Код минималистичен. Два исполняемых скрипта `/src/server.py` и `/src/db.py`.
В `/src/server.py` обрабатываются всего два URL: 

- `/` для отображения тестовой страницы с использованием шаблона `/src/templates/home.html`.
- `/data` для возврата тестовых данных из БД на основе параметров.

Кроме того, есть скрипт для генерации данных `/src/faker.py`. 
Его описание в конце раздела __Организация разработки/доработки__.

## Организация разработки/доработки

На хосте должны быть установлены docker и docker compose.

### Как поднять

Клонируем.

```bash
$ git clone <url ссылки репозитория>
```

Переходим в папку созданную после клонирования.
Если нужна свежая версия после клонирования, то не забываем команду в папке репозитория:

```bash
$ git pull
```

ВАЖНО! Все команды после клонирования выполняются в созданноый папке.
И те что касаются обновления репозитория из основного, и те что касаются работы с docker.
При разворачивании на внешнем хосте под простым пользователем для работы с docker понадобится
переходить в режим root.

```bash
$ sudo su
```

#### Один раз делаем настройки для БД (на тестовом уже сделаны)

Копируем образец конфига `.env.example` в файл конфига `.env`

```bash
$ cp .env.example .env
```

Редактируем значения настройки БД на нужные.

```bash
$ nano .env
```

#### Делаем сборку имиджа бекэнд приложения

Важно. Это нужно делать каждый раз после изменений Dockerfile приложения или его файлов.

```bash
$ sudo docker compose build
```

#### Запускаем docker compose

Теперь можно поднять контейнера приложения.

```bash
$ sudo docker compose up -d
```

Если нужно смотреть лог происходящего в контейнере, то опускаем ключ `-d` и видим все сообщения.

```bash
$ sudo docker compose up
```

#### Проверяем, что контейнеры запущены командой docker

```bash
$ sudo docker ps
```

#### Останавливаем docker compose если нужно отключить

```bash
$ sudo docker compose stop
```

#### Заливаем данные в БД

При запущенных контейнерах можно заменить данные на данные другого периода.
Для этого нужно запустить скрипт в контейнере приложения.

```bash
$ docker exec -it ratiometry-charts-app-1 python faker.py "2023-09-01 00:00:00" "2023-09-15 12:45:00"
```

`ratiometry-charts-app-1` - это текущее имя контейнера на тестовом сервере. Оно может отличаться для других серверов.

__"2023-09-01 00:00:00"__ __"2023-09-15 12:45:00"__ - значения временного периода.

Сейчас скрипт очищает БД и заливает данные за период по новой.
В скрипте faker.py заданы следующие константы для указания размерности генерируемых значений.

```python

MIN_VALUE = 1 # Минимальное значение
MAX_VALUE = 1000 # Максимальное значение
MAX_DEC = 2 # Максимальное число знаков после запятой для значения
```
