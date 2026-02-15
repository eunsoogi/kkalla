ENV := development
IMAGE_REGISTRY := ghcr.io/eunsoogi
IMAGE_NAME_PREFIX := kkalla
IMAGE_TAG := latest
CLUSTER_NAME := kkalla
HELM_RELEASE := kkalla
HELM_NAMESPACE := default

# sed inplace: macOS (BSD) needs -i '', GNU sed needs -i only
ifeq ($(shell uname),Darwin)
  SED_INPLACE := sed -i ''
else
  SED_INPLACE := sed -i
endif

.PHONY: clean
clean:
	@docker system prune -a -f

.PHONY: version
version:
	@$(SED_INPLACE) "s/^appVersion:.*$$/appVersion: \"$(VERSION)\"/" ./api/helm/Chart.yaml
	@$(SED_INPLACE) "s/^appVersion:.*$$/appVersion: \"$(VERSION)\"/" ./ui/helm/Chart.yaml
	@$(SED_INPLACE) "s/^appVersion:.*$$/appVersion: \"$(VERSION)\"/" ./helm/Chart.yaml

make-cache-dir:
	@mkdir -p api/.cache
	@mkdir -p ui/.cache

.PHONY: build
build: make-cache-dir
	@IMAGE_REGISTRY=$(IMAGE_REGISTRY) \
	IMAGE_NAME_PREFIX=$(IMAGE_NAME_PREFIX) \
	IMAGE_TAG=$(IMAGE_TAG) \
	ENV=$(ENV) \
	docker buildx bake

.PHONY: import
import:
	@k3d image import \
		-c $(CLUSTER_NAME) \
		$(IMAGE_REGISTRY)/$(IMAGE_NAME_PREFIX)-api:$(IMAGE_TAG) \
		$(IMAGE_REGISTRY)/$(IMAGE_NAME_PREFIX)-ui:$(IMAGE_TAG)

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

# Optional: set SET_IMAGE_TAG to pin image tag at install (e.g. CI); otherwise Chart appVersion is used
INSTALL_SET_IMAGE_TAG := $(if $(SET_IMAGE_TAG),--set api.image.tag=$(SET_IMAGE_TAG) --set ui.image.tag=$(SET_IMAGE_TAG),)

.PHONY: install
install: deps
	@helm upgrade $(HELM_RELEASE) ./helm \
		--install \
		--create-namespace \
		-n $(HELM_NAMESPACE) \
		-f ./helm/values/$(ENV).yaml \
		-f ./secrets.yaml \
		$(INSTALL_SET_IMAGE_TAG)

.PHONY: uninstall
uninstall:
	@helm uninstall $(HELM_RELEASE) \
		-n $(HELM_NAMESPACE)

.PHONY: clean-pvc
clean-pvc:
	kubectl delete pvc -n $(HELM_NAMESPACE) data-$(HELM_RELEASE)-mariadb-0

.PHONY: all
all: build import install
