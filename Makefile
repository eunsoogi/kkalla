ENV := development
IMAGE_REGISTRY := eunsoogi
IMAGE_NAME_PREFIX := ai-invest-assistant
IMAGE_TAG := latest
CLUSTER_NAME := ai-invest-assistant
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

.PHONY: create-cluster
create-cluster:
	k3d cluster create $(CLUSTER_NAME) \
		-v $(PWD)/api/src:/app/api/src \
		-v $(PWD)/ui/src:/app/ui/src \
		-v $(PWD)/ui/public:/app/ui/public \
		-p 3306:3306@loadbalancer \
		-p 3001:3001@loadbalancer \
		-p 3000:3000@loadbalancer \
		-p 80:80@loadbalancer

.PHONY: delete-cluster
delete-cluster:
	k3d cluster delete $(CLUSTER_NAME)

deps:
	@helm dep up ./api/helm
	@helm dep up ./ui/helm
	@helm dep up ./helm

.PHONY: install
install: deps
	@helm upgrade $(HELM_RELEASE) ./helm \
		--install \
		--create-namespace \
		-n $(HELM_NAMESPACE) \
		-f ./helm/values/$(ENV).yaml \
		-f ./secrets.yaml

.PHONY: uninstall
uninstall:
	@helm uninstall $(HELM_RELEASE) \
		-n $(HELM_NAMESPACE)

.PHONY: all
all: build install
