variable "IMAGE_REGISTRY" {
    default = ""
}

variable "IMAGE_NAME_PREFIX" {
    default = ""
}

variable "IMAGE_TAG" {
    default = ""
}

variable "ENV" {
    default = ""
}

group "default" {
  targets = ["api", "ui"]
}

target "api" {
  context = "api"
  target = "runner-${ENV}"
  tags = ["${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-api:${IMAGE_TAG}"]
  cache-from = [
    "type=gha,scope=api",
    "type=registry,ref=${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-api:${IMAGE_TAG}"
  ]
  cache-to = ["type=gha,scope=api,mode=max"]
}

target "ui" {
  context = "ui"
  target = "runner-${ENV}"
  tags = ["${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-ui:${IMAGE_TAG}"]
  cache-from = [
    "type=gha,scope=ui",
    "type=registry,ref=${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-ui:${IMAGE_TAG}"
  ]
  cache-to = ["type=gha,scope=ui,mode=max"]
}
