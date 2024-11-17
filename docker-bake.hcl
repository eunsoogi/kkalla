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
  cache-from = [
    "type=gha",
    "type=local,src=/path/to/cache"
  ]
  cache-to = [
    "type=gha,mode=max",
    "type=local,dest=/path/to/cache,mode=max"
  ]
}

target "ui" {
  context = "./ui"
  target = "${BUILD_TARGET}"
  tags = ["${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-ui:${IMAGE_TAG}"]
  platforms = ["linux/arm64"]
    cache-from = [
    "type=gha",
    "type=local,src=/path/to/cache"
  ]
  cache-to = [
    "type=gha,mode=max",
    "type=local,dest=/path/to/cache,mode=max"
  ]
}
