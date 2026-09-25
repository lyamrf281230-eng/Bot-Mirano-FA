const {
    PermissionsBitField,
    EmbedBuilder,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ActivityType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

module.exports = {
    async execute(message, command, args, tools) {

        const {
            PREFIX,
            sendLog,
            getConfig,
            updateConfig,
            loadJSON,
            saveJSON,
            WARNINGS_FILE
        } = tools;

        const guild = message.guild;

        if (!guild) return;

        const member = message.mentions.members.first();
        const botMember = guild.members.me;

        // ==================================================
        // OWNER SYSTEM
        // ==================================================

        const OWNERS_FILE = path.join(__dirname, "..", "owners.json");

        // Créer owners.json s'il n'existe pas
        if (!fs.existsSync(OWNERS_FILE)) {
            fs.writeFileSync(
                OWNERS_FILE,
                JSON.stringify({}, null, 4)
            );
        }

        let ownersData = {};

        try {
            ownersData = JSON.parse(
                fs.readFileSync(OWNERS_FILE, "utf8")
            );
        } catch {
            ownersData = {};
        }

        if (!ownersData[guild.id]) {
            ownersData[guild.id] = [];
        }

        // Sauvegarder les owners
        const saveOwners = () => {
            fs.writeFileSync(
                OWNERS_FILE,
                JSON.stringify(ownersData, null, 4)
            );
        };

        // Le propriétaire Discord du serveur est toujours owner
        const isServerOwner =
            message.author.id === guild.ownerId;

        const isOwner =
            isServerOwner ||
            ownersData[guild.id].includes(message.author.id);

        // ==================================================
        // OWNER COMMANDS
        // ==================================================

        if (command === "owner") {

            // Seul le propriétaire du serveur ou un owner
            // peut gérer les owners
            if (!isOwner) {
                return message.reply(
                    "❌ **Accès refusé.** Seuls les **Owners** peuvent utiliser cette commande."
                );
            }

            const subCommand =
                args[0]?.toLowerCase();

            // ------------------------------------------
            // +owner list
            // ------------------------------------------

            if (subCommand === "list") {

                const ownerIds = ownersData[guild.id] || [];

                const ownerList = ownerIds.length
                    ? ownerIds
                        .map(
                            (id, index) =>
                                `**${index + 1}.** <@${id}> \`(${id})\``
                        )
                        .join("\n")
                    : "Aucun owner supplémentaire.";

                const embed = new EmbedBuilder()
                    .setTitle("👑 Liste des Owners")
                    .setDescription(
                        `**Propriétaire du serveur :** <@${guild.ownerId}>\n\n` +
                        `**Owners supplémentaires :**\n${ownerList}`
                    )
                    .setColor(0x5865f2)
                    .setFooter({
                        text: `Total : ${ownerIds.length} owner(s)`
                    })
                    .setTimestamp();

                return message.reply({
                    embeds: [embed]
                });
            }

            // ------------------------------------------
            // +owner derank all
            // +owner derank nombre
            // ------------------------------------------

            if (subCommand === "derank") {

                if (!isServerOwner) {
                    return message.reply(
                        "❌ Seul le **propriétaire du serveur** peut utiliser `+owner derank`."
                    );
                }

                const value = args[1]?.toLowerCase();

                if (!value) {
                    return message.reply(
                        `❌ Utilisation :\n` +
                        `\`${PREFIX}owner derank all\`\n` +
                        `\`${PREFIX}owner derank nombre\``
                    );
                }

                // --------------------------------------
                // DERANK ALL
                // --------------------------------------

                if (value === "all") {

                    const count =
                        ownersData[guild.id].length;

                    ownersData[guild.id] = [];

                    saveOwners();

                    return message.reply(
                        `✅ **${count} owner(s)** ont été retirés.\n\n` +
                        `👑 Le propriétaire du serveur reste Owner.`
                    );
                }

                // --------------------------------------
                // DERANK NOMBRE
                // --------------------------------------

                const amount = parseInt(value);

                if (
                    isNaN(amount) ||
                    amount < 1
                ) {
                    return message.reply(
                        `❌ Mets un nombre valide ou \`all\`.\n\n` +
                        `Exemple : \`${PREFIX}owner derank 2\``
                    );
                }

                const currentOwners =
                    ownersData[guild.id];

                if (currentOwners.length === 0) {
                    return message.reply(
                        "❌ Il n'y a aucun owner supplémentaire."
                    );
                }

                const removedOwners =
                    currentOwners.splice(0, amount);

                ownersData[guild.id] =
                    currentOwners;

                saveOwners();

                return message.reply(
                    `✅ **${removedOwners.length} owner(s)** ont été retirés.\n\n` +
                    `👑 Le propriétaire du serveur reste Owner.`
                );
            }

            // ------------------------------------------
            // +owner @membre
            // ------------------------------------------

            if (!member) {
                return message.reply(
                    `❌ Utilisation :\n` +
                    `\`${PREFIX}owner @membre\`\n` +
                    `\`${PREFIX}owner list\`\n` +
                    `\`${PREFIX}owner derank all\`\n` +
                    `\`${PREFIX}owner derank nombre\``
                );
            }

            // Seul le propriétaire peut ajouter des owners
            if (!isServerOwner) {
                return message.reply(
                    "❌ Seul le **propriétaire du serveur** peut ajouter un Owner."
                );
            }

            if (member.user.bot) {
                return message.reply(
                    "❌ Tu ne peux pas mettre un bot Owner."
                );
            }

            if (member.id === guild.ownerId) {
                return message.reply(
                    "❌ Le propriétaire du serveur est déjà Owner."
                );
            }

            if (ownersData[guild.id].includes(member.id)) {
                return message.reply(
                    `❌ **${member.user.tag}** est déjà Owner.`
                );
            }

            ownersData[guild.id].push(member.id);

            saveOwners();

            return message.reply(
                `👑 **${member.user.tag}** est maintenant **Owner** du bot.`
            );
        }

        // ==================================================
        // UNOWNER
        // ==================================================

        if (command === "unowner") {

            if (!isOwner) {
                return message.reply(
                    "❌ **Accès refusé.** Seuls les **Owners** peuvent utiliser cette commande."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ Utilisation : \`${PREFIX}unowner @membre\``
                );
            }

            if (member.id === guild.ownerId) {
                return message.reply(
                    "❌ Impossible de retirer le Owner du serveur."
                );
            }

            if (!isServerOwner) {
                return message.reply(
                    "❌ Seul le **propriétaire du serveur** peut retirer un Owner."
                );
            }

            const index =
                ownersData[guild.id].indexOf(member.id);

            if (index === -1) {
                return message.reply(
                    `❌ **${member.user.tag}** n'est pas Owner.`
                );
            }

            ownersData[guild.id].splice(index, 1);

            saveOwners();

            return message.reply(
                `✅ **${member.user.tag}** n'est plus Owner.`
            );
        }

        // ==================================================
        // OWNER ACCESS
        // ==================================================

        // Toutes les autres commandes nécessitent Owner
        if (!isOwner) {
            return message.reply(
                "❌ **Accès refusé.**\n\n" +
                "Tu dois être **Owner** pour utiliser ce bot."
            );
        }

        // ==================================================
        // HELP
        // ==================================================

        if (command === "help" || command === "commands") {

            const categories = {

                moderation: {
                    label: "🔨 MODÉRATION",
                    description: "Commandes de modération",
                    commands: [
                        `${PREFIX}ban @membre raison`,
                        `${PREFIX}unban ID`,
                        `${PREFIX}kick @membre raison`,
                        `${PREFIX}mute @membre`,
                        `${PREFIX}unmute @membre`,
                        `${PREFIX}timeout @membre minutes`,
                        `${PREFIX}warn @membre raison`,
                        `${PREFIX}warnings @membre`,
                        `${PREFIX}clear 20`,
                        `${PREFIX}purge 20`
                    ]
                },

                roles: {
                    label: "🎭 RÔLES",
                    description: "Gestion des rôles",
                    commands: [
                        `${PREFIX}addrole @membre rôle`,
                        `${PREFIX}delrole @membre rôle`,
                        `${PREFIX}role rôle`,
                        `${PREFIX}unrole rôle`,
                        `${PREFIX}createrole rôle`,
                        `${PREFIX}deleterole rôle`,
                        `${PREFIX}roleinfo rôle`,
                        `${PREFIX}listroles`,
                        `${PREFIX}autorole @role`,
                        `${PREFIX}removeautorole`
                    ]
                },

                salons: {
                    label: "🔒 SALONS",
                    description: "Gestion des salons",
                    commands: [
                        `${PREFIX}lock`,
                        `${PREFIX}unlock`,
                        `${PREFIX}hide`,
                        `${PREFIX}unhide`,
                        `${PREFIX}slowmode 10`,
                        `${PREFIX}createchannel nom`,
                        `${PREFIX}deletechannel`,
                        `${PREFIX}renamechannel nom`,
                        `${PREFIX}createcategory nom`,
                        `${PREFIX}deletecategory nom`,
                        `${PREFIX}channelinfo`
                    ]
                },

                protection: {
                    label: "🛡️ PROTECTION",
                    description: "Protection du serveur",
                    commands: [
                        `${PREFIX}antispam on/off`,
                        `${PREFIX}antilink on/off`,
                        `${PREFIX}antiraid on/off`,
                        `${PREFIX}antimention on/off`,
                        `${PREFIX}anticaps on/off`,
                        `${PREFIX}antiflood on/off`,
                        `${PREFIX}antidiscord on/off`,
                        `${PREFIX}verification on/off`,
                        `${PREFIX}lockdown`,
                        `${PREFIX}unlockdown`
                    ]
                },

                configuration: {
                    label: "📋 CONFIGURATION",
                    description: "Configuration du serveur",
                    commands: [
                        `${PREFIX}setup`,
                        `${PREFIX}config`,
                        `${PREFIX}setlogs #salon`,
                        `${PREFIX}setwelcome #salon`,
                        `${PREFIX}prefix`,
                        `${PREFIX}setprefix !`
                    ]
                },

                tickets: {
                    label: "🎫 TICKETS",
                    description: "Système de tickets",
                    commands: [
                        `${PREFIX}ticket`
                    ]
                },

                automatisation: {
                    label: "👋 AUTOMATISATION",
                    description: "Automatisation du serveur",
                    commands: [
                        `${PREFIX}welcome`,
                        `${PREFIX}autorole @role`
                    ]
                },

                bot: {
                    label: "🤖 BOT",
                    description: "Commandes du bot",
                    commands: [
                        `${PREFIX}status streaming texte`,
                        `${PREFIX}status playing texte`,
                        `${PREFIX}status watching texte`,
                        `${PREFIX}status listening texte`,
                        `${PREFIX}resetstatus`,
                        `${PREFIX}ping`,
                        `${PREFIX}botinfo`
                    ]
                },

                informations: {
                    label: "👤 INFORMATIONS",
                    description: "Informations sur les membres et le serveur",
                    commands: [
                        `${PREFIX}userinfo @membre`,
                        `${PREFIX}serverinfo`,
                        `${PREFIX}avatar @membre`,
                        `${PREFIX}membercount`,
                        `${PREFIX}servericon`
                    ]
                },

                utilitaires: {
                    label: "📢 UTILITAIRES",
                    description: "Commandes utiles",
                    commands: [
                        `${PREFIX}say texte`,
                        `${PREFIX}announce texte`,
                        `${PREFIX}poll question`,
                        `${PREFIX}nick @membre pseudo`
                    ]
                },

                fun: {
                    label: "🎮 FUN",
                    description: "Commandes fun",
                    commands: [
                        `${PREFIX}8ball question`,
                        `${PREFIX}coinflip`,
                        `${PREFIX}dice`,
                        `${PREFIX}roll 100`,
                        `${PREFIX}choose A B C`
                    ]
                },

                owner: {
                    label: "👑 OWNER",
                    description: "Gestion des Owners du bot",
                    commands: [
                        `${PREFIX}owner @membre`,
                        `${PREFIX}unowner @membre`,
                        `${PREFIX}owner list`,
                        `${PREFIX}owner derank all`,
                        `${PREFIX}owner derank nombre`
                    ]
                }
            };

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`help_${message.author.id}`)
                .setPlaceholder("📚 Choisis une catégorie")
                .addOptions(
                    Object.entries(categories).map(
                        ([value, category]) => ({
                            label: category.label,
                            description: category.description,
                            value
                        })
                    )
                );

            const row = new ActionRowBuilder()
                .addComponents(menu);

            const embed = new EmbedBuilder()
                .setTitle("📚 KokoroBots")
                .setDescription(
                    "Bienvenue sur *KokoroBots*\n\n" +
                    "Sélectionne une catégorie dans le menu ci-dessous " +
                    "pour afficher ses commandes.\n\n" +
                    `📚 **${Object.keys(categories).length} catégories disponibles**\n\n` +
                    `👑 **${ownersData[guild.id].length + 1} Owner(s)**\n\n` +
                    `💡 Utilise **${PREFIX}help** à tout moment pour rouvrir ce menu.`
                )
                .setFooter({
                    text: "KokoroBots • Menu d'aide"
                })
                .setTimestamp();

            const helpMessage = await message.reply({
                embeds: [embed],
                components: [row]
            });

            const collector =
                helpMessage.createMessageComponentCollector({
                    time: 120000
                });

            collector.on("collect", async interaction => {

                if (interaction.user.id !== message.author.id) {
                    return interaction.reply({
                        content: "❌ Ce menu appartient à une autre personne.",
                        ephemeral: true
                    });
                }

                const selected = interaction.values[0];

                const category = categories[selected];

                if (!category) {
                    return interaction.reply({
                        content: "❌ Catégorie introuvable.",
                        ephemeral: true
                    });
                }

                const commandList = category.commands
                    .map(cmd => `\`${cmd}\``)
                    .join("\n");

                const categoryEmbed = new EmbedBuilder()
                    .setTitle(category.label)
                    .setDescription(
                        `**${category.description}**\n\n${commandList}`
                    )
                    .setFooter({
                        text: "KokoroBots • Menu d'aide"
                    })
                    .setTimestamp();

                await interaction.update({
                    embeds: [categoryEmbed],
                    components: [row]
                });
            });

            collector.on("end", async () => {

                const disabledMenu =
                    new StringSelectMenuBuilder()
                        .setCustomId(
                            `help_expired_${message.author.id}`
                        )
                        .setPlaceholder(
                            "⏱️ Menu expiré — Fait +help (KokoroBots)"
                        )
                        .setDisabled(true)
                        .addOptions({
                            label: "Menu expiré",
                            description:
                                "Refais +help pour ouvrir le menu",
                            value: "expired"
                        });

                const disabledRow =
                    new ActionRowBuilder()
                        .addComponents(disabledMenu);

                await helpMessage.edit({
                    components: [disabledRow]
                }).catch(() => {});
            });

            return;
        }

        // ==================================================
        // PING
        // ==================================================

        if (command === "ping") {
            return message.reply(
                `🏓 Pong ! **${message.client.ws.ping}ms**`
            );
        }

        // ==================================================
        // BOTINFO
        // ==================================================

        if (command === "botinfo") {

            const embed = new EmbedBuilder()
                .setTitle("🤖 Informations du bot")
                .setThumbnail(
                    message.client.user.displayAvatarURL()
                )
                .addFields(
                    {
                        name: "Nom",
                        value: message.client.user.tag,
                        inline: true
                    },
                    {
                        name: "Serveurs",
                        value:
                            `${message.client.guilds.cache.size}`,
                        inline: true
                    },
                    {
                        name: "Préfixe",
                        value: PREFIX,
                        inline: true
                    },
                    {
                        name: "Owners",
                        value:
                            `${ownersData[guild.id].length + 1}`,
                        inline: true
                    },
                    {
                        name: "Node",
                        value: process.version,
                        inline: true
                    }
                )
                .setFooter({
                    text: "Logs Bots"
                })
                .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // STATUS
        // ==================================================

        if (command === "status") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const type =
                args.shift()?.toLowerCase();

            const text =
                args.join(" ");

            if (!type || !text) {
                return message.reply(
                    `❌ Exemple : ${PREFIX}status streaming EN DIRECT`
                );
            }

            let activity;

            if (type === "streaming") {

                activity = {
                    name: text,
                    type: ActivityType.Streaming,
                    url: "https://www.twitch.tv/"
                };

            } else if (type === "playing") {

                activity = {
                    name: text,
                    type: ActivityType.Playing
                };

            } else if (type === "watching") {

                activity = {
                    name: text,
                    type: ActivityType.Watching
                };

            } else if (type === "listening") {

                activity = {
                    name: text,
                    type: ActivityType.Listening
                };

            } else {

                return message.reply(
                    "❌ Types : streaming, playing, watching, listening."
                );
            }

            message.client.user.setPresence({
                activities: [activity],
                status: "online"
            });

            return message.reply(
                `✅ Statut changé : **${text}**`
            );
        }

        // ==================================================
        // RESET STATUS
        // ==================================================

        if (command === "resetstatus") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            message.client.user.setPresence({
                activities: [],
                status: "online"
            });

            return message.reply(
                "✅ Statut supprimé."
            );
        }

        // ==================================================
        // BAN
        // ==================================================

        if (command === "ban") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.BanMembers
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}ban @membre raison`
                );
            }

            if (member.id === message.author.id) {
                return message.reply(
                    "❌ Tu ne peux pas te bannir."
                );
            }

            if (!member.bannable) {
                return message.reply(
                    "❌ Je ne peux pas bannir ce membre."
                );
            }

            const reason =
                args.slice(1).join(" ") ||
                "Aucune raison";

            await member.ban({ reason });

            await message.reply(
                `🔨 **${member.user.tag}** a été banni.\n📝 ${reason}`
            );

            return sendLog(
                guild,
                `🔨 **${message.author.tag}** a banni **${member.user.tag}**.\n📝 ${reason}`
            );
        }

        // ==================================================
        // UNBAN
        // ==================================================

        if (command === "unban") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.BanMembers
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const id = args[0];

            if (!id) {
                return message.reply(
                    `❌ ${PREFIX}unban ID`
                );
            }

            try {

                await guild.members.unban(id);

                return message.reply(
                    `✅ **${id}** a été débanni.`
                );

            } catch {

                return message.reply(
                    "❌ Impossible de débannir cet utilisateur."
                );
            }
        }

        // ==================================================
        // KICK
        // ==================================================

        if (command === "kick") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.KickMembers
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}kick @membre raison`
                );
            }

            if (!member.kickable) {
                return message.reply(
                    "❌ Je ne peux pas expulser ce membre."
                );
            }

            const reason =
                args.slice(1).join(" ") ||
                "Aucune raison";

            await member.kick(reason);

            await message.reply(
                `👢 **${member.user.tag}** a été expulsé.`
            );

            return sendLog(
                guild,
                `👢 **${message.author.tag}** a expulsé **${member.user.tag}**.\n📝 ${reason}`
            );
        }

        // ==================================================
        // MUTE
        // ==================================================

        if (command === "mute") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ModerateMembers
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}mute @membre`
                );
            }

            await member.timeout(
                10 * 60 * 1000,
                `Mute par ${message.author.tag}`
            );

            return message.reply(
                `🔇 **${member.user.tag}** est mute pendant 10 minutes.`
            );
        }

        // ==================================================
        // UNMUTE
        // ==================================================

        if (command === "unmute") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ModerateMembers
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}unmute @membre`
                );
            }

            await member.timeout(null);

            return message.reply(
                `🔊 **${member.user.tag}** n'est plus mute.`
            );
        }

        // ==================================================
        // TIMEOUT
        // ==================================================

        if (command === "timeout") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ModerateMembers
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}timeout @membre minutes`
                );
            }

            const minutes =
                parseInt(args[1]) || 10;

            if (
                minutes < 1 ||
                minutes > 40320
            ) {
                return message.reply(
                    "❌ Mets entre 1 et 40320 minutes."
                );
            }

            await member.timeout(
                minutes * 60 * 1000,
                `Timeout par ${message.author.tag}`
            );

            return message.reply(
                `⏱️ **${member.user.tag}** timeout pendant **${minutes} minutes**.`
            );
        }

        // ==================================================
        // WARN
        // ==================================================

        if (command === "warn") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageMessages
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}warn @membre raison`
                );
            }

            const reason =
                args.slice(1).join(" ") ||
                "Aucune raison";

            const warnings =
                loadJSON(WARNINGS_FILE);

            if (!warnings[guild.id]) {
                warnings[guild.id] = {};
            }

            if (!warnings[guild.id][member.id]) {
                warnings[guild.id][member.id] = [];
            }

            warnings[guild.id][member.id].push({
                reason,
                moderator: message.author.id,
                date: new Date().toISOString()
            });

            saveJSON(
                WARNINGS_FILE,
                warnings
            );

            await message.reply(
                `⚠️ **${member.user.tag}** a reçu un warn.\n📝 ${reason}`
            );

            return sendLog(
                guild,
                `⚠️ **${member.user.tag}** a reçu un warn de **${message.author.tag}**.\n📝 ${reason}`
            );
        }

        // ==================================================
        // WARNINGS
        // ==================================================

        if (
            command === "warnings" ||
            command === "warns"
        ) {

            const target =
                member || message.member;

            const warnings =
                loadJSON(WARNINGS_FILE);

            const list =
                warnings[guild.id]?.[target.id] || [];

            const description =
                list.length
                    ? list.map(
                        (warn, index) =>
                            `**${index + 1}.** ${warn.reason}`
                    ).join("\n")
                    : "Aucun avertissement.";

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `⚠️ Warns de ${target.user.tag}`
                    )
                    .setDescription(description)
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // CLEAR / PURGE
        // ==================================================

        if (
            command === "clear" ||
            command === "purge"
        ) {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageMessages
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const amount =
                parseInt(args[0]);

            if (
                !amount ||
                amount < 1 ||
                amount > 100
            ) {
                return message.reply(
                    "❌ Mets un nombre entre 1 et 100."
                );
            }

            await message.channel.bulkDelete(
                amount,
                true
            );

            return message.channel.send(
                `🧹 **${amount} messages supprimés.**`
            );
        }

        // ==================================================
        // ADDROLE
        // ==================================================

        if (command === "addrole") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageRoles
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}addrole @membre rôle`
                );
            }

            const role =
                guild.roles.cache.find(
                    r =>
                        r.name.toLowerCase() ===
                        args.slice(1).join(" ").toLowerCase()
                );

            if (!role) {
                return message.reply(
                    "❌ Rôle introuvable."
                );
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                return message.reply(
                    "❌ Mon rôle doit être au-dessus de ce rôle."
                );
            }

            await member.roles.add(role);

            return message.reply(
                `✅ ${role} ajouté à **${member.user.tag}**.`
            );
        }

        // ==================================================
        // DELROLE
        // ==================================================

        if (command === "delrole") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageRoles
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}delrole @membre rôle`
                );
            }

            const role =
                guild.roles.cache.find(
                    r =>
                        r.name.toLowerCase() ===
                        args.slice(1).join(" ").toLowerCase()
                );

            if (!role) {
                return message.reply(
                    "❌ Rôle introuvable."
                );
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                return message.reply(
                    "❌ Mon rôle est trop élever au tien."
                );
            }

            await member.roles.remove(role);

            return message.reply(
                `✅ ${role} retiré de **${member.user.tag}**.`
            );
        }

        // ==================================================
        // ROLE
        // ==================================================

        if (command === "role") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageRoles
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const role =
                guild.roles.cache.find(
                    r =>
                        r.name.toLowerCase() ===
                        args.join(" ").toLowerCase()
                );

            if (!role) {
                return message.reply(
                    "❌ Rôle introuvable."
                );
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                return message.reply(
                    "❌ Mon rôle est trop bas."
                );
            }

            await message.member.roles.add(role);

            return message.reply(
                `✅ Tu as reçu ${role}.`
            );
        }

        // ==================================================
        // UNROLE
        // ==================================================

        if (command === "unrole") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageRoles
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const role =
                guild.roles.cache.find(
                    r =>
                        r.name.toLowerCase() ===
                        args.join(" ").toLowerCase()
                );

            if (!role) {
                return message.reply(
                    "❌ Rôle introuvable."
                );
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                return message.reply(
                    "❌ Mon rôle est trop haut pour être retiré."
                );
            }

            await message.member.roles.remove(role);

            return message.reply(
                `✅ ${role} retiré.`
            );
        }

        // ==================================================
        // CREATE ROLE
        // ==================================================

        if (command === "createrole") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageRoles
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const name =
                args.join(" ");

            if (!name) {
                return message.reply(
                    `❌ ${PREFIX}createrole Staff`
                );
            }

            const role =
                await guild.roles.create({
                    name,
                    reason:
                        `Créé par ${message.author.tag}`
                });

            return message.reply(
                `✅ Rôle créé : ${role}`
            );
        }

        // ==================================================
        // DELETE ROLE
        // ==================================================

        if (command === "deleterole") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageRoles
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const role =
                guild.roles.cache.find(
                    r =>
                        r.name.toLowerCase() ===
                        args.join(" ").toLowerCase()
                );

            if (!role) {
                return message.reply(
                    "❌ Rôle introuvable."
                );
            }

            if (
                role.position >=
                botMember.roles.highest.position
            ) {
                return message.reply(
                    "❌ Je ne peux pas supprimer ce rôle."
                );
            }

            await role.delete();

            return message.reply(
                "🗑️ Rôle supprimé."
            );
        }

        // ==================================================
        // ROLEINFO
        // ==================================================

        if (command === "roleinfo") {

            const role =
                guild.roles.cache.find(
                    r =>
                        r.name.toLowerCase() ===
                        args.join(" ").toLowerCase()
                );

            if (!role) {
                return message.reply(
                    "❌ Rôle introuvable."
                );
            }

            const embed =
                new EmbedBuilder()
                    .setTitle(`🎭 ${role.name}`)
                    .addFields(
                        {
                            name: "ID",
                            value: role.id
                        },
                        {
                            name: "Membres",
                            value:
                                `${role.members.size}`
                        },
                        {
                            name: "Position",
                            value:
                                `${role.position}`
                        }
                    )
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // LIST ROLES
        // ==================================================

        if (command === "listroles") {

            const roles =
                guild.roles.cache
                    .filter(
                        role =>
                            role.id !== guild.id
                    )
                    .sort(
                        (a, b) =>
                            b.position - a.position
                    )
                    .map(
                        role =>
                            `${role} — ${role.members.size} membre(s)`
                    )
                    .join("\n");

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        "🎭 Rôles du serveur"
                    )
                    .setDescription(
                        roles || "Aucun rôle."
                    )
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // AUTOROLE
        // ==================================================

        if (command === "autorole") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const role =
                message.mentions.roles.first() ||
                guild.roles.cache.find(
                    r =>
                        r.name.toLowerCase() ===
                        args.join(" ").toLowerCase()
                );

            if (!role) {
                return message.reply(
                    `❌ ${PREFIX}autorole @role`
                );
            }

            updateConfig(guild.id, {
                autorole: role.id
            });

            return message.reply(
                `✅ Autorole configuré : ${role}`
            );
        }

        // ==================================================
        // REMOVE AUTOROLE
        // ==================================================

        if (command === "removeautorole") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            updateConfig(guild.id, {
                autorole: null
            });

            return message.reply(
                "✅ Autorole désactivé."
            );
        }

        // ==================================================
        // LOCK
        // ==================================================

        if (command === "lock") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            await message.channel.permissionOverwrites.edit(
                guild.roles.everyone,
                {
                    SendMessages: false
                }
            );

            await message.reply(
                "🔒 **Salon verrouillé.**"
            );

            return sendLog(
                guild,
                `🔒 **${message.author.tag}** a verrouillé ${message.channel}.`
            );
        }

        // ==================================================
        // UNLOCK
        // ==================================================

        if (command === "unlock") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            await message.channel.permissionOverwrites.edit(
                guild.roles.everyone,
                {
                    SendMessages: null
                }
            );

            return message.reply(
                "🔓 **Salon déverrouillé.**"
            );
        }

        // ==================================================
        // HIDE
        // ==================================================

        if (command === "hide") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            await message.channel.permissionOverwrites.edit(
                guild.roles.everyone,
                {
                    ViewChannel: false
                }
            );

            return message.reply(
                "👻 **Salon caché.**"
            );
        }

        // ==================================================
        // UNHIDE
        // ==================================================

        if (command === "unhide") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            await message.channel.permissionOverwrites.edit(
                guild.roles.everyone,
                {
                    ViewChannel: null
                }
            );

            return message.reply(
                "👁️ **Salon visible.**"
            );
        }

        // ==================================================
        // SLOWMODE
        // ==================================================

        if (command === "slowmode") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const seconds =
                parseInt(args[0]);

            if (
                isNaN(seconds) ||
                seconds < 0 ||
                seconds > 21600
            ) {
                return message.reply(
                    "❌ Mets entre 0 et 21600 secondes."
                );
            }

            await message.channel.setRateLimitPerUser(
                seconds
            );

            return message.reply(
                `🐌 Slowmode : **${seconds}s**`
            );
        }

        // ==================================================
        // CREATE CHANNEL
        // ==================================================

        if (command === "createchannel") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const name =
                args.join("-").toLowerCase();

            if (!name) {
                return message.reply(
                    `❌ ${PREFIX}createchannel nom`
                );
            }

            const channel =
                await guild.channels.create({
                    name,
                    type: ChannelType.GuildText
                });

            return message.reply(
                `✅ Salon créé : ${channel}`
            );
        }

        // ==================================================
        // DELETE CHANNEL
        // ==================================================

        if (command === "deletechannel") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const name =
                message.channel.name;

            await message.channel.delete();

            await sendLog(
                guild,
                `🗑️ **${message.author.tag}** a supprimé #${name}.`
            );

            return;
        }

        // ==================================================
        // RENAME CHANNEL
        // ==================================================

        if (command === "renamechannel") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const name =
                args.join("-").toLowerCase();

            if (!name) {
                return message.reply(
                    `❌ ${PREFIX}renamechannel nouveau-nom`
                );
            }

            await message.channel.setName(name);

            return message.reply(
                `✅ Salon renommé en **#${name}**.`
            );
        }

        // ==================================================
        // CREATE CATEGORY
        // ==================================================

        if (command === "createcategory") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const name =
                args.join(" ");

            if (!name) {
                return message.reply(
                    `❌ ${PREFIX}createcategory nom`
                );
            }

            const category =
                await guild.channels.create({
                    name,
                    type: ChannelType.GuildCategory
                });

            return message.reply(
                `✅ Catégorie créée : **${category.name}**`
            );
        }

        // ==================================================
        // DELETE CATEGORY
        // ==================================================

        if (command === "deletecategory") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const name =
                args.join(" ");

            const category =
                guild.channels.cache.find(
                    channel =>
                        channel.type ===
                            ChannelType.GuildCategory &&
                        channel.name.toLowerCase() ===
                            name.toLowerCase()
                );

            if (!category) {
                return message.reply(
                    "❌ Catégorie introuvable."
                );
            }

            await category.delete();

            return message.reply(
                "🗑️ Catégorie supprimée."
            );
        }

        // ==================================================
        // CHANNEL INFO
        // ==================================================

        if (command === "channelinfo") {

            const channel =
                message.mentions.channels.first() ||
                message.channel;

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `💬 #${channel.name}`
                    )
                    .addFields(
                        {
                            name: "ID",
                            value: channel.id,
                            inline: true
                        },
                        {
                            name: "Type",
                            value:
                                channel.type ===
                                    ChannelType.GuildText
                                    ? "Texte"
                                    : "Autre",
                            inline: true
                        }
                    )
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // NICK
        // ==================================================

        if (command === "nick") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageNicknames
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            if (!member) {
                return message.reply(
                    `❌ ${PREFIX}nick @membre pseudo`
                );
            }

            const nickname =
                args.slice(1).join(" ");

            if (!nickname) {
                return message.reply(
                    "❌ Pseudo manquant."
                );
            }

            await member.setNickname(
                nickname
            );

            return message.reply(
                `✅ Nouveau pseudo : **${nickname}**`
            );
        }

        // ==================================================
        // SAY
        // ==================================================

        if (command === "say") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageMessages
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const text =
                args.join(" ");

            if (!text) {
                return message.reply(
                    `❌ ${PREFIX}say texte`
                );
            }

            await message.delete()
                .catch(() => {});

            return message.channel.send(text);
        }

        // ==================================================
        // ANNOUNCE
        // ==================================================

        if (command === "announce") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageMessages
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const text =
                args.join(" ");

            if (!text) {
                return message.reply(
                    `❌ ${PREFIX}announce texte`
                );
            }

            const embed =
                new EmbedBuilder()
                    .setTitle("📢 ANNONCE")
                    .setDescription(text)
                    .setTimestamp()
                    .setFooter({
                        text: "Annonce par Logs"
                    });

            return message.channel.send({
                embeds: [embed]
            });
        }

        // ==================================================
        // POLL
        // ==================================================

        if (command === "poll") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageMessages
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const question =
                args.join(" ");

            if (!question) {
                return message.reply(
                    `❌ ${PREFIX}poll Ta question`
                );
            }

            const poll =
                await message.channel.send(
                    `📊 **SONDAGE**\n\n${question}\n\n👍 **Oui** | 👎 **Non**`
                );

            await poll.react("👍");
            await poll.react("👎");

            return;
        }

        // ==================================================
        // USERINFO
        // ==================================================

        if (command === "userinfo") {

            const target =
                member || message.member;

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `👤 ${target.user.tag}`
                    )
                    .setThumbnail(
                        target.user.displayAvatarURL({
                            size: 1024
                        })
                    )
                    .addFields(
                        {
                            name: "🆔 ID",
                            value: target.id,
                            inline: true
                        },
                        {
                            name: "🤖 Bot",
                            value:
                                target.user.bot
                                    ? "Oui"
                                    : "Non",
                            inline: true
                        },
                        {
                            name: "🎭 Rôles",
                            value:
                                `${Math.max(
                                    target.roles.cache.size - 1,
                                    0
                                )}`,
                            inline: true
                        },
                        {
                            name: "📅 Compte créé",
                            value:
                                `<t:${Math.floor(
                                    target.user.createdTimestamp / 1000
                                )}:F>`
                        }
                    )
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // SERVERINFO
        // ==================================================

        if (command === "serverinfo") {

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `🏠 ${guild.name}`
                    )
                    .setThumbnail(
                        guild.iconURL({
                            size: 1024
                        })
                    )
                    .addFields(
                        {
                            name: "👥 Membres",
                            value:
                                `${guild.memberCount}`,
                            inline: true
                        },
                        {
                            name: "🎭 Rôles",
                            value:
                                `${guild.roles.cache.size}`,
                            inline: true
                        },
                        {
                            name: "💬 Salons",
                            value:
                                `${guild.channels.cache.size}`,
                            inline: true
                        },
                        {
                            name: "🆔 ID",
                            value: guild.id
                        }
                    )
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // MEMBERCOUNT
        // ==================================================

        if (command === "membercount") {

            return message.reply(
                `👥 Le serveur possède **${guild.memberCount} membres**.`
            );
        }

        // ==================================================
        // AVATAR
        // ==================================================

        if (command === "avatar") {

            const target =
                member || message.member;

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `🖼️ Avatar de ${target.user.tag}`
                    )
                    .setImage(
                        target.user.displayAvatarURL({
                            size: 1024
                        })
                    );

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // SERVER ICON
        // ==================================================

        if (command === "servericon") {

            const icon =
                guild.iconURL({
                    size: 1024
                });

            if (!icon) {
                return message.reply(
                    "❌ Le serveur n'a pas d'icône."
                );
            }

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `🖼️ ${guild.name}`
                    )
                    .setImage(icon)
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // TICKET
        // ==================================================

        if (command === "ticket") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.ManageChannels
            )) {
                return message.reply(
                    "❌ Permission insuffisante."
                );
            }

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                "ticket_create"
                            )
                            .setLabel(
                                "Créer un ticket"
                            )
                            .setEmoji("🎫")
                            .setStyle(
                                ButtonStyle.Primary
                            )
                    );

            const embed =
                new EmbedBuilder()
                    .setTitle("🎫 SUPPORT")
                    .setDescription(
                        "Clique sur le bouton pour ouvrir un ticket."
                    )
                    .setTimestamp();

            return message.channel.send({
                embeds: [embed],
                components: [row]
            });
        }

        // ==================================================
        // SET LOGS
        // ==================================================

        if (command === "setlogs") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const channel =
                message.mentions.channels.first();

            if (!channel) {
                return message.reply(
                    `❌ ${PREFIX}setlogs #logs`
                );
            }

            updateConfig(guild.id, {
                logChannel: channel.id
            });

            return message.reply(
                `✅ Logs configurés sur ${channel}.`
            );
        }

        // ==================================================
        // SET WELCOME
        // ==================================================

        if (command === "setwelcome") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const channel =
                message.mentions.channels.first();

            if (!channel) {
                return message.reply(
                    `❌ ${PREFIX}setwelcome #bienvenue`
                );
            }

            updateConfig(guild.id, {
                welcomeChannel: channel.id
            });

            return message.reply(
                `✅ Salon de bienvenue : ${channel}`
            );
        }

        // ==================================================
        // CONFIG
        // ==================================================

        if (command === "config") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const config =
                getConfig(guild.id);

            const autorole =
                config.autorole
                    ? `<@&${config.autorole}>`
                    : "Non configuré";

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        "⚙️ CONFIGURATION"
                    )
                    .addFields(
                        {
                            name: "🛡️ Anti-spam",
                            value:
                                config.antiSpam
                                    ? "🟢 ON"
                                    : "🔴 OFF",
                            inline: true
                        },
                        {
                            name: "🔗 Anti-liens",
                            value:
                                config.antiLink
                                    ? "🟢 ON"
                                    : "🔴 OFF",
                            inline: true
                        },
                        {
                            name: "🚨 Anti-raid",
                            value:
                                config.antiRaid
                                    ? "🟢 ON"
                                    : "🔴 OFF",
                            inline: true
                        },
                        {
                            name: "🎭 Autorole",
                            value: autorole
                        },
                        {
                            name: "📋 Logs",
                            value:
                                config.logChannel
                                    ? `<#${config.logChannel}>`
                                    : "Non configurés"
                        },
                        {
                            name: "👋 Bienvenue",
                            value:
                                config.welcomeChannel
                                    ? `<#${config.welcomeChannel}>`
                                    : "Non configuré"
                        }
                    )
                    .setTimestamp();

            return message.reply({
                embeds: [embed]
            });
        }

        // ==================================================
        // SETUP
        // ==================================================

        if (command === "setup") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const result =
                await message.reply(
                    "⚙️ Configuration automatique du serveur..."
                );

            let logs =
                guild.channels.cache.find(
                    channel =>
                        channel.name === "logs" &&
                        channel.type ===
                            ChannelType.GuildText
                );

            let welcome =
                guild.channels.cache.find(
                    channel =>
                        channel.name === "bienvenue" &&
                        channel.type ===
                            ChannelType.GuildText
                );

            let tickets =
                guild.channels.cache.find(
                    channel =>
                        channel.name === "tickets" &&
                        channel.type ===
                            ChannelType.GuildText
                );

            if (!logs) {
                logs =
                    await guild.channels.create({
                        name: "logs",
                        type:
                            ChannelType.GuildText
                    });
            }

            if (!welcome) {
                welcome =
                    await guild.channels.create({
                        name: "bienvenue",
                        type:
                            ChannelType.GuildText
                    });
            }

            if (!tickets) {
                tickets =
                    await guild.channels.create({
                        name: "tickets",
                        type:
                            ChannelType.GuildText
                    });
            }

            updateConfig(guild.id, {
                logChannel: logs.id,
                welcomeChannel: welcome.id,
                antiSpam: true,
                antiLink: true,
                antiRaid: true
            });

            const embed =
                new EmbedBuilder()
                    .setTitle(
                        "✅ SERVEUR CONFIGURÉ"
                    )
                    .setDescription(
                        `**📋 Logs :** ${logs}\n` +
                        `**👋 Bienvenue :** ${welcome}\n` +
                        `**🎫 Tickets :** ${tickets}\n\n` +
                        "🛡️ Anti-spam : ON\n" +
                        "🔗 Anti-liens : ON\n" +
                        "🚨 Anti-raid : ON"
                    )
                    .setTimestamp();

            return result.edit({
                content: "",
                embeds: [embed]
            });
        }

        // ==================================================
        // PROTECTION
        // ==================================================

        const protectionCommands = [
            "antispam",
            "antilink",
            "antiraid",
            "antimention",
            "anticaps",
            "antiflood",
            "antidiscord",
            "verification"
        ];

        if (
            protectionCommands.includes(command)
        ) {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const value =
                args[0]?.toLowerCase();

            if (
                value !== "on" &&
                value !== "off"
            ) {
                return message.reply(
                    `❌ ${PREFIX}${command} on/off`
                );
            }

            const configNames = {
                antispam: "antiSpam",
                antilink: "antiLink",
                antiraid: "antiRaid",
                antimention: "antiMention",
                anticaps: "antiCaps",
                antiflood: "antiFlood",
                antidiscord: "antiDiscord",
                verification: "verification"
            };

            const emojis = {
                antispam: "🛡️",
                antilink: "🔗",
                antiraid: "🚨",
                antimention: "📢",
                anticaps: "🔠",
                antiflood: "🌊",
                antidiscord: "🚫",
                verification: "✅"
            };

            updateConfig(guild.id, {
                [configNames[command]]:
                    value === "on"
            });

            return message.reply(
                `${emojis[command]} ${command} : **${value.toUpperCase()}**`
            );
        }

        // ==================================================
        // LOCKDOWN
        // ==================================================

        if (command === "lockdown") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const channels =
                guild.channels.cache.filter(
                    channel =>
                        channel.type ===
                            ChannelType.GuildText
                );

            for (
                const [, channel]
                of channels
            ) {

                await channel.permissionOverwrites
                    .edit(
                        guild.roles.everyone,
                        {
                            SendMessages: false
                        }
                    )
                    .catch(() => {});
            }

            await sendLog(
                guild,
                `🚨 **${message.author.tag}** a activé le lockdown.`
            );

            return message.reply(
                "🚨 **LOCKDOWN ACTIVÉ sur les salons texte.**"
            );
        }

        // ==================================================
        // UNLOCKDOWN
        // ==================================================

        if (command === "unlockdown") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const channels =
                guild.channels.cache.filter(
                    channel =>
                        channel.type ===
                            ChannelType.GuildText
                );

            for (
                const [, channel]
                of channels
            ) {

                await channel.permissionOverwrites
                    .edit(
                        guild.roles.everyone,
                        {
                            SendMessages: null
                        }
                    )
                    .catch(() => {});
            }

            return message.reply(
                "✅ **LOCKDOWN DÉSACTIVÉ.**"
            );
        }

        // ==================================================
        // PREFIX
        // ==================================================

        if (command === "prefix") {

            const config =
                getConfig(guild.id);

            return message.reply(
                `⌨️ Préfixe actuel : **${config.prefix || PREFIX}**`
            );
        }

        // ==================================================
        // SET PREFIX
        // ==================================================

        if (command === "setprefix") {

            if (!message.member.permissions.has(
                PermissionsBitField.Flags.Administrator
            )) {
                return message.reply(
                    "❌ Administrateur requis."
                );
            }

            const newPrefix =
                args[0];

            if (
                !newPrefix ||
                newPrefix.length > 3
            ) {
                return message.reply(
                    "❌ Le préfixe doit faire entre 1 et 3 caractères."
                );
            }

            updateConfig(guild.id, {
                prefix: newPrefix
            });

            return message.reply(
                `✅ Nouveau préfixe enregistré : **${newPrefix}**`
            );
        }

        // ==================================================
        // WELCOME
        // ==================================================

        if (command === "welcome") {

            const config =
                getConfig(guild.id);

            if (!config.welcomeChannel) {
                return message.reply(
                    "❌ Le salon de bienvenue n'est pas configuré."
                );
            }

            return message.reply(
                `👋 Salon de bienvenue : <#${config.welcomeChannel}>`
            );
        }

        // ==================================================
        // 8BALL
        // ==================================================

        if (command === "8ball") {

            const responses = [
                "Oui.",
                "Non.",
                "Peut-être.",
                "Certainement.",
                "Je ne sais pas.",
                "Très probable.",
                "Peu probable."
            ];

            const question =
                args.join(" ");

            if (!question) {
                return message.reply(
                    `❌ ${PREFIX}8ball ta question`
                );
            }

            const response =
                responses[
                    Math.floor(
                        Math.random() *
                        responses.length
                    )
                ];

            return message.reply(
                `🎱 **Question :** ${question}\n**Réponse :** ${response}`
            );
        }

        // ==================================================
        // COINFLIP
        // ==================================================

        if (command === "coinflip") {

            const result =
                Math.random() < 0.5
                    ? "🪙 Pile"
                    : "🪙 Face";

            return message.reply(result);
        }

        // ==================================================
        // DICE
        // ==================================================

        if (command === "dice") {

            const result =
                Math.floor(
                    Math.random() * 6
                ) + 1;

            return message.reply(
                `🎲 Tu as obtenu **${result}**.`
            );
        }

        // ==================================================
        // ROLL
        // ==================================================

        if (command === "roll") {

            const max =
                parseInt(args[0]) || 100;

            if (
                max < 1 ||
                max > 1000000
            ) {
                return message.reply(
                    "❌ Maximum : 1 000 000."
                );
            }

            const result =
                Math.floor(
                    Math.random() * max
                ) + 1;

            return message.reply(
                `🎲 Résultat : **${result} / ${max}**`
            );
        }

        // ==================================================
        // CHOOSE
        // ==================================================

        if (command === "choose") {

            if (args.length < 2) {
                return message.reply(
                    `❌ Exemple : ${PREFIX}choose pizza kebab burger`
                );
            }

            const choice =
                args[
                    Math.floor(
                        Math.random() *
                        args.length
                    )
                ];

            return message.reply(
                `🎯 Je choisis : **${choice}**`
            );
        }

        // ==================================================
        // UNKNOWN
        // ==================================================

        return message.reply(
            `❌ Commande inconnue. Fais ${PREFIX}help.`
        );
    }
};