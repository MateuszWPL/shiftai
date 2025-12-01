from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Import models and Base for autogenerate
from app.core.dependencies import Base
from app.models import *  # noqa: F401, F403

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Get database URL from settings
from app.core.config import settings

# Override sqlalchemy.url if DATABASE_URL is set
if settings.DATABASE_URL:
    # Convert asyncpg URL to sync URL for Alembic (use psycopg2)
    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    # Force 127.0.0.1 and UTF-8 to avoid encoding errors on Windows/Polish systems
    db_url = db_url.replace("@localhost", "@127.0.0.1")
    if "?" not in db_url:
        db_url += "?client_encoding=utf8"
    config.set_main_option("sqlalchemy.url", db_url)
else:
    # Use SQLite as fallback for autogenerate when no DATABASE_URL is set
    # This allows generating migrations without a running PostgreSQL instance
    default_url = config.get_main_option("sqlalchemy.url")
    if not default_url or default_url == "driver://user:pass@localhost/dbname":
        print("Note: No DATABASE_URL set. Using temporary SQLite for autogenerate.")
        print("This is only for generating migration files.")
        config.set_main_option("sqlalchemy.url", "sqlite:///temp_alembic.db")

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection, target_metadata=target_metadata
            )

            with context.begin_transaction():
                context.run_migrations()
    except Exception as e:
        error_msg = str(e)
        if "Connection refused" in error_msg or "OperationalError" in str(type(e).__name__):
            print("\n" + "="*70)
            print("ERROR: Cannot connect to database.")
            print("="*70)
            print("\nTo create migrations, you have two options:")
            print("\n1. Set up PostgreSQL and set DATABASE_URL:")
            print("   $env:DATABASE_URL='postgresql+asyncpg://user:pass@localhost/shiftai'")
            print("\n2. Create a manual migration (without autogenerate):")
            print("   alembic revision -m 'Initial migration'")
            print("\n" + "="*70)
        raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
