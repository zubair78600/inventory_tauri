import requests

def add_training_data(question, sql):
    url = "http://127.0.0.1:8765/train"
    payload = {
        "training_type": "question_sql",
        "question": question,
        "content": sql
    }
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print(f"Successfully trained: '{question}' -> SQL")
        else:
            print(f"Failed to train. Status: {response.status_code}, Error: {response.text}")
    except Exception as e:
        print(f"Error connecting to server: {e}")

if __name__ == "__main__":
    print("Add a new training example:")
    q = input("Question: ")
    s = input("SQL Query: ")
    if q and s:
        add_training_data(q, s)
    else:
        print("Both question and SQL are required.")
