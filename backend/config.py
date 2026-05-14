from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str
    database_url: str
    database_url_unpooled: str
    upstash_redis_url: str
    upstash_redis_token: str
    pinecone_api_key: str
    pinecone_index: str = "agentos-memory"
    dev_mode: bool = False  # set DEV_MODE=true to use Haiku for all agents
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "agentos-artefacts"
    next_public_r2_public_url: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
