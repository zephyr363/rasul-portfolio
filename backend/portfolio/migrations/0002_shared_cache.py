from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0001_initial")]
    operations = [
        migrations.RunSQL(
            "CREATE TABLE portfolio_cache (cache_key varchar(255) PRIMARY KEY, value text NOT NULL, expires timestamptz NOT NULL); CREATE INDEX portfolio_cache_expires ON portfolio_cache (expires);",
            "DROP TABLE portfolio_cache;",
        )
    ]
