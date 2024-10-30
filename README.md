# AI 투자 어시스턴트

## 비밀 키 생성

API 키를 암호화하기 위한 비밀 키를 생성합니다.

```bash
head -c32 /dev/urandom | base64 > secrets/api_secret_key
```

## 환경 변수 설정

`.env.example` 파일을 `.env` 파일로 복사한 후 파일 내용을 채워 넣어주세요.
