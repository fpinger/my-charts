import datetime
import os
import pymysql
import random
import sys
import time

"""
    требуется два параметра в виде даты и времени для начала и окончания периода генерации данных
"""
ARGS_LEN = 3 # Количество параметров для команды (первым идет имя скрипта)
FROM_DT = 1 # Номер параметра начала периода
TO_DT = 2 # Номер параметра окончания периода
DATETIME_RULE = "%Y-%m-%d %H:%M:%S" # Формат строки даты и времени
MAX_QUERY_ITEMS = 100 # Вставляем максимум по 100 элементов
MIN_VALUE = 1 # Минимальное значение
MAX_VALUE = 1000 # Максимальное значение
MAX_DEC = 2 # Максимальное число знаков после запятой для значения
# -- db
DB_HOST = "db"
DB_CHARSET = "utf8mb4"
DB_CURSOR_TYPE = pymysql.cursors.DictCursor

# ---  Временной период
print('Args:', sys.argv)

args_len = len(sys.argv)
if args_len != ARGS_LEN:
    print('Not valid args')
    exit(1)

try:
    # Начало периода
    from_dt = datetime.datetime.strptime(sys.argv[FROM_DT], DATETIME_RULE)
    t = from_dt.timetuple()
    from_timestamp = int(time.mktime(t))

    # Окончание периода
    to_dt = datetime.datetime.strptime(sys.argv[TO_DT], DATETIME_RULE)
    t = to_dt.timetuple()
    to_timestamp = int(time.mktime(t)) + 1 # Как-то так
except Exception as er:
    print(f'Not valid datetime {er}')
    exit(1)
    
print('Period:', from_timestamp, to_timestamp)

# -----------------------------------------------------------------------------
# --- Настройки БД
dbname = os.environ.get("SANIC_MYSQL_DATABASE")
dbuser = os.environ.get("SANIC_MYSQL_USER")
dbpasw = os.environ.get("SANIC_MYSQL_PASSWORD")

print('DB config:', dbname, dbuser, dbpasw)

# --- Подключаемся
connection = pymysql.connect(host=DB_HOST, user=dbuser, password=dbpasw, 
    db=dbname, charset=DB_CHARSET, cursorclass=DB_CURSOR_TYPE)

# --- Создаем таблицу, если ее нет
try:
    cursor = connection.cursor()                                     
    # SQL query string
    sql_query = """CREATE TABLE IF NOT EXISTS values_table (
        dt_timestamp INT NOT NULL,
        value1 DOUBLE(10,2), 
        INDEX(dt_timestamp)
    );
    """
    # Execute the sqlQuery
    cursor.execute(sql_query)
    # SQL query string
    sql_query = "SHOW TABLES"
    # Execute the sqlQuery
    cursor.execute(sql_query)
    rows = cursor.fetchall()
    for row in rows:
        print(row)
except Exception as e:
    print(f"Exeception occured:{e}")
    exit(1)

# --- Очищаем таблицу, если она есть
try:
    cursor.execute(sql_query)
    # SQL query string
    sql_query = "TRUNCATE TABLE values_table"
    # Execute the sqlQuery
    cursor.execute(sql_query)
except Exception as e:
    print(f"Exeception occured:{e}")
    exit(1)
# -----------------------------------------------------------------------------
# --- Перебираем значения периода
values = []
total_rows = 0;
print('Req items:', to_timestamp - from_timestamp)
for dt in range(from_timestamp, to_timestamp):
    v = round(random.uniform(MIN_VALUE, MAX_VALUE), MAX_DEC)
    values.append((dt, v))
    if len(values) >= MAX_QUERY_ITEMS:
        # print('---\nInsert', values)
        # Вставить в БД
        sql = "INSERT INTO values_table (dt_timestamp, value1) VALUES (%s, %s)"
        try:  
            cursor.executemany(sql, values)
            print(cursor.rowcount, "records inserted.")
        except:
            print('Something went wrong.')
        connection.commit()
        total_rows += len(values)
        # Збросить данные перед новой порцией
        values = []

# --- Если есть едоработка в цикле выше
if values and len(values) < MAX_QUERY_ITEMS:
    # print('---\nLast insert', value)
    # Вставить в БД
    sql = "INSERT INTO values_table (dt_timestamp, value1) VALUES (%s, %s)"
    try:  
        cursor.executemany(sql, values)
        print(cursor.rowcount, "records inserted.")
    except:
        print('Something went wrong.')
    connection.commit()
    total_rows += len(values)
print(total_rows)

# -----------------------------------------------------------------------------
if connection:
    connection.close()
