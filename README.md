# AI 투자 어시스턴트

## 환경 구성

### 비밀 키 설정

[secret.yaml.example](secret.yaml.example) 파일을 `secret.yaml` 파일로 복사하여 아래 값을 입력해주세요.

#### `auth.db.password`

MariaDB의 유저 비밀번호입니다.

#### `auth.db.rootPassword`

MariaDB의 루트 비밀번호입니다.

#### `auth.google.id`

Google OAuth 2.0 클라이언트 ID입니다. 자세한 내용은 [이곳](https://developers.google.com/identity/protocols/oauth2/web-server?hl=ko)을 참조하세요.

#### `auth.google.secret`

Google OAuth 2.0 클라이언트 암호입니다. 자세한 내용은 [이곳](https://developers.google.com/identity/protocols/oauth2/web-server?hl=ko)을 참조하세요.

### 개발 환경

개발 환경은 Minikube를 사용합니다. 다음 명령어를 사용하여 Minikube를 설치합니다.

> Minikube 시스템 및 어플리케이션을 포함해 구동하기 위해 vCore는 최소 2개여야 하며, 메모리는 최소 6GB 이상이어야 합니다.

```bash
minikube start --cpus 2 --memory 6144
```

다음 명령어를 사용하여 이미지를 빌드합니다.

```bash
make build ENV=development IMAGE_TAG=latest
```

다음 명령어를 사용하여 이미지를 푸시합니다.

```bash
make push ENV=development IMAGE_TAG=latest
```

다음 명령어를 사용하여 로컬 소스 코드를 Minikube에 마운트합니다.

```bash
make mount
```

반대의 경우, 다음 명령어를 사용하여 로컬 소스 코드를 Minikube에서 마운트 해제합니다.

```bash
make unmount
```

다음 명령어를 사용하여 터널링을 사용합니다. `LoadBalancer` 타입 서비스에 `External-IP`를 부여합니다.

```bash
make tunnel
```

반대의 경우, 다음 명령어를 사용하여 터널링을 해제합니다.

```bash
make untunnel
```

다음 명령어를 사용하여 어플리케이션을 설치합니다.

```bash
make install ENV=development
```

반대의 경우, 다음 명령어를 사용하여 어플리케이션을 삭제합니다.

```bash
make uninstall
```

### 운영 환경

운영 환경은 Kubernetes를 사용합니다.

> 어플리케이션을 구동하기 위해 vCore는 최소 0.4개여야 하며, 메모리는 최소 512MB 이상이어야 합니다.

```bash
make build ENV=production IMAGE_TAG=1.0.0
```

다음 명령어를 사용하여 이미지를 푸시합니다.

```bash
make push ENV=production IMAGE_TAG=1.0.0
```

다음 명령어를 사용하여 어플리케이션을 설치합니다.

```bash
make install ENV=production
```

반대의 경우, 다음 명령어를 사용하여 어플리케이션을 삭제합니다.

```bash
make uninstall
```
