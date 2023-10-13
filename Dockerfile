FROM python:3.11.3-bullseye
WORKDIR /app
COPY ./src .
# RUN python -m pip install sanic sanic-ext databases[aiomysql] Jinja2
# RUN pip freeze > requirements.txt
RUN pip install -r requirements.txt
EXPOSE 8084
CMD ["python", "server.py"]
