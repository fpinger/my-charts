from sanic import Sanic
from sanic.response import text, json

app = Sanic("Ratiometry")
app.static("/", "./assets", name="main")

import db

@app.get('/')
@app.ext.template("home.html")
async def home(request):
    data_url = app.config.DATA_URL
    return {"data_url": data_url}

# Возвращаем данные
@app.get('/data')
async def chart_data(request):
    print('Request', request.args)
    # ---
    value_name = request.args.get('valueName')
    if value_name not in ['value1',]:
        return json({'error:' f'Not valid value name: "{value_name}"'})
    cache_id = float(request.args.get('cacheId'));
    seconds_per_pix = int(cache_id);
    start_limit = int(request.args.get('startLimit'));
    end_limit = int(request.args.get('endLimit'));
    # ---
    # Получаем общее число записей за период
    values = {'start_limit': start_limit, 'end_limit': end_limit}
    query = """
        SELECT COUNT(*) AS values_count 
        FROM values_table 
        WHERE dt_timestamp BETWEEN :start_limit AND :end_limit;
    """
    info = await request.app.ctx.mysql.fetch_one(query=query, values=values)
    values_count = info[0]
    dataset = []
    if values_count:
        print(f'Rows count: {values_count}')
        # --- Получаем список записей
        query = f"SELECT dt_timestamp, {value_name} FROM values_table WHERE dt_timestamp BETWEEN :start_limit AND :end_limit ORDER BY dt_timestamp ASC;"
        rows = await request.app.ctx.mysql.fetch_all(query=query, values=values)
        if seconds_per_pix <= 1:
            for row in rows:
                dataset.append(list(row))
        else:
            # --- Получаем промежутки для запросов
            left_limit = start_limit
            limits = []
            while (left_limit + seconds_per_pix) <= end_limit:
                limits.append((left_limit, (left_limit + seconds_per_pix)))
                left_limit += seconds_per_pix
            limits.append((left_limit, end_limit))
            print(f'Limits count: {len(limits)}')
            # ---
            LEFT_LIMIT_INDEX = 0
            RIGHT_LIMIT_INDEX = 1
            TIMESTAMP_INDEX = 0
            VALUE_INDEX = 1
            limit = None
            min_value = None
            max_value = None
            limit = limits.pop(0)
            for row in rows:
                # Получаем новый промежуток
                while limit[RIGHT_LIMIT_INDEX] < row[TIMESTAMP_INDEX]:
                    limit = limits.pop(0)
                    if min_value and max_value:
                        if min_value[VALUE_INDEX] == max_value[VALUE_INDEX]:
                            dataset.append(list(min_value))
                        elif min_value[TIMESTAMP_INDEX] < max_value[TIMESTAMP_INDEX]:
                            dataset.append(list(min_value))
                            dataset.append(list(max_value))
                        else:
                            dataset.append(list(max_value))
                            dataset.append(list(min_value))
                        min_value = None
                        max_value = None
                # Проверить и обновить min max
                if not min_value:
                    min_value = row
                    max_value = row
                elif min_value[VALUE_INDEX] > row[VALUE_INDEX]:
                    min_value = row
                elif max_value[VALUE_INDEX] < row[VALUE_INDEX]:
                    max_value = row
    # ---
    result = {
        'valueName': value_name,
        'cacheId': cache_id, #seconds_per_pix,
        'startLimit': start_limit,
        'endLimit': end_limit,
        'dataset': dataset,
    }
    return json(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)

