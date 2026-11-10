"""Train a small local model on Capri's dataset, then write a GGUF file for Ollama.

Run it where there's a GPU (Google Colab, a rented machine, or this PC with a small model):

    pip install -r requirements.txt
    python train.py --data capri-dataset.jsonl --base unsloth/gemma-3-1b-it

Then in Capri: Settings > AI brain > Improve her > Install a trained model, and pick the .gguf.

The dataset comes from your own chats, her lines from the show and examples written for her: keep it, and the model made from it, to yourself.
A tenth of the examples (capri-valid.jsonl) is held back and only measured, to show whether training helped.
"""
import argparse
import json
import os

from datasets import Dataset
from transformers import DataCollatorForSeq2Seq, Trainer, TrainingArguments
from unsloth import FastLanguageModel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="capri-dataset.jsonl")
    parser.add_argument("--valid", default="capri-valid.jsonl")
    parser.add_argument("--base", default="unsloth/gemma-3-1b-it")
    parser.add_argument("--out", default="capri-trained")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--batch", type=int, default=2, help="2 fits a 4 GB card with a small model")
    parser.add_argument("--max-len", type=int, default=768)
    args = parser.parse_args()

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=args.base, max_seq_length=args.max_len, load_in_4bit=True
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    def read(path):
        with open(path, encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    rows = read(args.data)

    def encode(row):
        text = tokenizer.apply_chat_template(row["messages"], tokenize=False)
        tokens = tokenizer(text, truncation=True, max_length=args.max_len)
        tokens["labels"] = tokens["input_ids"].copy()
        return tokens

    data = Dataset.from_list(rows).map(encode, remove_columns=["messages"])

    trainer = Trainer(
        model=model,
        train_dataset=data,
        data_collator=DataCollatorForSeq2Seq(tokenizer, padding=True),
        args=TrainingArguments(
            output_dir=args.out,
            per_device_train_batch_size=args.batch,
            gradient_accumulation_steps=2,
            num_train_epochs=args.epochs,
            learning_rate=2e-4,
            fp16=True,
            logging_steps=10,
            save_strategy="no",
            report_to=[],
        ),
    )
    valid = (
        Dataset.from_list(read(args.valid)).map(encode, remove_columns=["messages"])
        if os.path.exists(args.valid)
        else None
    )
    if valid is not None:
        print("Held-back examples, before training:", trainer.evaluate(valid))
    trainer.train()
    if valid is not None:
        print("Held-back examples, after training:", trainer.evaluate(valid))

    model.save_pretrained_gguf(args.out, tokenizer, quantization_method="q4_k_m")
    print(f"Done. The .gguf file is in {args.out}/")


if __name__ == "__main__":
    main()
