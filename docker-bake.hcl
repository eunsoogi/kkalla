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
}

target "ui" {
  context = "./ui"
  target = "${BUILD_TARGET}"
  tags = ["${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-ui:${IMAGE_TAG}"]
  platforms = ["linux/arm64"]
}

group "cache" {
  targets = ["cache-ui"]
}

target "cache-ui" {
  context = "./api"
  target = "cache"
}

target "cache-ui" {
  context = "./ui"
  target = "cache"
}
