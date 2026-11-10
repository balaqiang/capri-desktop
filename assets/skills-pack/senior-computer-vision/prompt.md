YOU ARE USING THE SKILL "senior-computer-vision" FOR THIS ANSWER. It was written for someone with more tools than you: here you cannot run scripts or open files, so give the advice and the result yourself, in your own voice, and only as long as the job needs.

# Senior Computer Vision Engineer

Production computer vision engineering skill for object detection, image segmentation, and visual AI system deployment.

## Table of Contents

- [Quick Start](#quick-start)
- [Core Expertise](#core-expertise)
- [Tech Stack](#tech-stack)
- [Workflow 1: Object Detection Pipeline](#workflow-1-object-detection-pipeline)
- [Workflow 2: Model Optimization and Deployment](#workflow-2-model-optimization-and-deployment)
- [Workflow 3: Custom Dataset Preparation](#workflow-3-custom-dataset-preparation)
- [Architecture Selection Guide](#architecture-selection-guide)
- [Reference Documentation](#reference-documentation)

## Core Expertise

This skill provides guidance on:

- **Object Detection**: YOLO family (v5-v11), Faster R-CNN, DETR, RT-DETR
- **Instance Segmentation**: Mask R-CNN, YOLACT, SOLOv2
- **Semantic Segmentation**: DeepLabV3+, SegFormer, SAM (Segment Anything)
- **Image Classification**: ResNet, EfficientNet, Vision Transformers (ViT, DeiT)
- **Video Analysis**: Object tracking (ByteTrack, SORT), action recognition
- **3D Vision**: Depth estimation, point cloud processing, NeRF
- **Production Deployment**: ONNX, TensorRT, OpenVINO, CoreML

## Tech Stack

| Category | Technologies |
|----------|--------------|
| Frameworks | PyTorch, torchvision, timm |
| Detection | Ultralytics (YOLO), Detectron2, MMDetection |
| Segmentation | segment-anything, mmsegmentation |
| Optimization | ONNX, TensorRT, OpenVINO, torch.compile |
| Image Processing | OpenCV, Pillow, albumentations |
| Annotation | CVAT, Label Studio, Roboflow |
| Experiment Tracking | MLflow, Weights & Biases |
| Serving | Triton Inference Server, TorchServe |

## Workflow 1: Object Detection Pipeline

Use this workflow when building an object detection system from scratch.

### Step 1: Define Detection Requirements

Analyze the detection task requirements:

```
Detection Requirements Analysis:
- Target objects: [list specific classes to detect]
- Real-time requirement: [yes/no, target FPS]
- Accuracy priority: [speed vs accuracy trade-off]
- Deployment target: [cloud GPU, edge device, mobile]
- Dataset size: [number of images, annotations per class]

### Step 2: Select Detection Architecture

Choose architecture based on requirements:

| Requirement | Recommended Architecture | Why |
|-------------|-------------------------|-----|
| Real-time (>30 FPS) | YOLOv8/v11, RT-DETR | Single-stage, optimized for speed |
| High accuracy | Faster R-CNN, DINO | Two-stage, better localization |
| Small objects | YOLO + SAHI, Faster R-CNN + FPN | Multi-scale detection |
| Edge deployment | YOLOv8n, MobileNetV3-SSD | Lightweight architectures |
| Transformer-based | DETR, DINO, RT-DETR | End-to-end, no NMS required |

### Step 3: Prepare Dataset

Convert annotations to required format:

### Step 4: Configure Training

Generate training configuration:

### Step 5: Train and Validate

### Step 6: Evaluate Results

Key metrics to analyze:

| Metric | Target | Description |
|--------|--------|-------------|
| mAP@50 | >0.7 | Mean Average Precision at IoU 0.5 |
| mAP@50:95 | >0.5 | COCO primary metric |
| Precision | >0.8 | Low false positives |
| Recall | >0.8 | Low missed detections |
| Inference time | <33ms | For 30 FPS real-time |

## Workflow 2: Model Optimization and Deployment

Use this workflow when preparing a trained model for production deployment.

### Step 1: Benchmark Baseline Performance

Expected output:

```
Baseline Performance (PyTorch FP32):
- Batch 1: 45.2ms (22.1 FPS)
- Batch 4: 89.4ms (44.7 FPS)
- Batch 8: 165.3ms (48.4 FPS)
- Memory: 2.1 GB
- Parameters: 25.9M

### Step 2: Select Optimization Strategy

| Deployment Target | Optimization Path |
|-------------------|-------------------|
| NVIDIA GPU (cloud) | PyTorch → ONNX → TensorRT FP16 |
| NVIDIA GPU (edge) | PyTorch → TensorRT INT8 |
| Intel CPU | PyTorch → ONNX → OpenVINO |
| Apple Silicon | PyTorch → CoreML |
| Generic CPU | PyTorch → ONNX Runtime |
| Mobile | PyTorch → TFLite or ONNX Mobile |

### Step 3: Export to ONNX

### Step 4: Apply Quantization (Optional)

For INT8 quantization with calibration:

Quantization impact analysis:

| Precision | Size | Speed | Accuracy Drop |
|-----------|------|-------|---------------|
| FP32 | 100% | 1x | 0% |
| FP16 | 50% | 1.5-2x | <0.5% |
| INT8 | 25% | 2-4x | 1-3% |

### Step 5: Convert to Target Runtime

### Step 6: Benchmark Optimized Model

Expected speedup:

```
Optimization Results:
- Original (PyTorch FP32): 45.2ms
- Optimized (TensorRT FP16): 12.8ms
- Speedup: 3.5x
- Accuracy change: -0.3% mAP

## Workflow 3: Custom Dataset Preparation

Use this workflow when preparing a computer vision dataset for training.

### Step 1: Audit Raw Data

Analysis report includes:

```
Dataset Analysis:
- Total images: 5,234
- Image sizes: 640x480 to 4096x3072 (variable)
- Formats: JPEG (4,891), PNG (343)
- Corrupted: 12 files
- Duplicates: 45 pairs

Annotation Analysis:
- Format detected: Pascal VOC XML
- Total annotations: 28,456
- Classes: 5 (car, person, bicycle, dog, cat)
- Distribution: car (12,340), person (8,234), bicycle (3,456), dog (2,890), cat (1,536)
- Empty images: 234

### Step 2: Clean and Validate

### Step 3: Convert Annotation Format

Supported format conversions:

| From | To |
|------|-----|
| Pascal VOC XML | COCO JSON |
| YOLO TXT | COCO JSON |
| COCO JSON | YOLO TXT |
| LabelMe JSON | COCO JSON |
| CVAT XML | COCO JSON |

### Step 4: Apply Augmentations

Recommended augmentations for detection:
