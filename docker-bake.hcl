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

group "builder" {
  targets = ["builder-api", "builder-ui"]
}

target "builder-api" {
  context = "api"
  target = "builder"
  cache-from = ["type=gha,scope=builder-api"]
  cache-to = ["type=gha,scope=builder-api,mode=max"]
}

target "builder-ui" {
  context = "ui"
  target = "builder"
  cache-from = ["type=gha,scope=builder-ui"]
  cache-to = ["type=gha,scope=builder-ui,mode=max"]
}

group "cache" {
  targets = ["cache-api", "cache-ui"]
}

target "cache-api" {
  context = "api"
  target = "cache"
  cache-from = ["type=gha,scope=builder-api"]
  output = ["type=local,dest=api/.cache"]
}

target "cache-ui" {
  context = "ui"
  target = "cache"
  cache-from = ["type=gha,scope=builder-ui"]
  output = ["type=local,dest=ui/.cache"]
}

group "default" {
  targets = ["api", "ui"]
}

target "api" {
  context = "api"
  target = "${BUILD_TARGET}"
  platforms = ["linux/arm64"]
  tags = ["${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-api:${IMAGE_TAG}"]
  cache-from = [
    "type=gha,scope=builder-api",
    "type=gha,scope=prod-api",
  ]
  cache-to = ["type=gha,scope=prod-api,mode=max"]
}

target "ui" {
  context = "ui"
  target = "${BUILD_TARGET}"
  platforms = ["linux/arm64"]
  tags = ["${IMAGE_REGISTRY}/${IMAGE_NAME_PREFIX}-ui:${IMAGE_TAG}"]
  cache-from = [
    "type=gha,scope=builder-ui",
    "type=gha,scope=prod-ui",
  ]
  cache-to = ["type=gha,scope=prod-ui,mode=max"]
}
