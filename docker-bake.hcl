variable "IMAGE_REGISTRY" {
    default = ""
}

variable "IMAGE_NAME_PREFIX" {
    default = ""
}

variable "IMAGE_TAG" {
    default = ""
}

variable "BUILD_TARGET" {
    default = ""
}

group "default" {
  targets = ["api", "ui"]
}

target "api" {
  context = "./api"
  target = "${BUILD_TARGET}"
  tags = ["${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-api:${IMAGE_TAG}"]
  platforms = ["linux/arm64"]
  cache-from = ["*.cache-from=type=gha,scope=api"]
  cache-to = ["*.cache-to=type=gha,scope=api,mode=max"]
}

target "ui" {
  context = "./ui"
  target = "${BUILD_TARGET}"
  tags = ["${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-ui:${IMAGE_TAG}"]
  platforms = ["linux/arm64"]
  cache-from = ["*.cache-from=type=gha,scope=ui"]
  cache-to = ["*.cache-to=type=gha,scope=ui,mode=max"]
}

target "ui-cache" {
  context = "./ui"
  target = "cache"
  cache-from = ["*.cache-from=type=gha,scope=ui"]
}

group "cache" {
  targets = ["ui-cache"]
}
