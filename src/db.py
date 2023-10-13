from sanic import Sanic
from databases import Database

app = Sanic.get_app()

@app.before_server_start
async def setup_mysql(app: Sanic, _) -> None:
    DATABASE = app.config.MYSQL_DATABASE
    USER = app.config.MYSQL_USER
    PASSWORD = app.config.MYSQL_PASSWORD
    DSN = f"mysql+aiomysql://{USER}:{PASSWORD}@db:3306/{DATABASE}"
    app.ctx.mysql = Database(
        DSN,
        min_size=1,
        max_size=3,
    )

@app.after_server_start
async def connect_mysql(app: Sanic, _) -> None:
    await app.ctx.mysql.connect()

@app.after_server_stop
async def shutdown_mysql(app: Sanic, _) -> None:
    await app.ctx.mysql.disconnect()
