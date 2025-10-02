FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
ENV PORT=5001
EXPOSE 5001
CMD ["python","-u","app.py"]
