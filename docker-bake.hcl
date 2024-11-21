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

group "deps" {
  targets = ["deps-api", "deps-ui"]
}

target "deps-api" {
  context = "./api"
  target = "deps"
}

target "deps-ui" {
  context = "./ui"
  target = "deps"
}

group "builder" {
  targets = ["builder-api", "builder-ui"]
}

target "builder-api" {
  context = "./api"
  target = "builder"
}

target "builder-ui" {
  context = "./ui"
  target = "builder"
}

group "cache" {
  targets = ["cache-api", "cache-ui"]
}

target "cache-api" {
  context = "./api"
  target = "cache"
}

target "cache-ui" {
  context = "./ui"
  target = "cache"
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
