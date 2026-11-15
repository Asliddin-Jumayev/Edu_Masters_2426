from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
import app.models  # noqa: F401  (hamma jadvallar metadata ga tushishi uchun SHART)
from app.database.base import Base
from app.utils.config import settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
# Parol alembic.ini da emas — .env dan olinadi. (Sinxron drayver: pymysql)
DB_URL = settings.sync_database_url.render_as_string(hide_password=False).replace("%", "%%")


def run_migrations_offline() -> None:
    context.configure(url=DB_URL.replace("%%", "%"), target_metadata=target_metadata, literal_binds=True,
                      compare_type=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = DB_URL
    connectable = engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
