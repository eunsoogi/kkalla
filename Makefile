ENV := development
IMAGE_REGISTRY := eunsoogi
IMAGE_NAME_PREFIX := ai-invest-assistant
IMAGE_TAG := latest
HELM_RELEASE := ai-invest-assistant
HELM_NAMESPACE := default

.PHONY: clean
clean:
	@docker system prune -a -f

.PHONY: build
build:
	@IMAGE_REGISTRY=$(IMAGE_REGISTRY) \
	IMAGE_NAME_PREFIX=$(IMAGE_NAME_PREFIX) \
	IMAGE_TAG=$(IMAGE_TAG) \
	BUILD_TARGET=$(ENV) \
	docker buildx bake

.PHONY: push
push:
	@IMAGE_REGISTRY=$(IMAGE_REGISTRY) \
	IMAGE_NAME_PREFIX=$(IMAGE_NAME_PREFIX) \
	IMAGE_TAG=$(IMAGE_TAG) \
	BUILD_TARGET=$(ENV) \
	docker buildx bake --push

deps:
	@helm dep up ./api/helm
	@helm dep up ./ui/helm
	@helm dep up ./helm

.PHONY: template
template: deps
	@helm template ai-invent-assistant ./helm \
		-n $(HELM_NAMESPACE) \
		-f ./helm/values/$(ENV).yaml \
		-f ./secret.yaml

.PHONY: install
install: deps
	@helm upgrade $(HELM_RELEASE) ./helm \
		--install \
		--create-namespace \
		-n $(HELM_NAMESPACE) \
		-f ./helm/values/$(ENV).yaml \
		-f ./secret.yaml

.PHONY: uninstall
uninstall:
	@helm uninstall $(HELM_RELEASE) \
		-n $(HELM_NAMESPACE)

.PHONY: mount
mount:
	@nohup minikube mount ./api/src:/api/src 2>&1 &
	@nohup minikube mount ./ui/src:/ui/src 2>&1 &
	@nohup minikube mount ./ui/public:/ui/public 2>&1 &
	@echo "All mounts commands started."

.PHONY: unmount
unmount:
	@pkill -f "minikube mount"
	@echo "All mounts commands has stopped."

.PHONY: tunnel
tunnel:
	@nohup minikube tunnel 2>&1 &
	@echo "Tunnel command started."

.PHONY: untunnel
untunnel:
	@pkill -f "minikube tunnel"
	@echo "Tunnel command has stopped."

.PHONY: all
all: build push install
