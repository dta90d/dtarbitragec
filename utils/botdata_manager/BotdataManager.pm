#!/usr/bin/env perl

# BotdataManager.pm
# Written by dta90d on 2017.11.26.

# Perl script for managing botdata through command line.

package BotdataManager;

use Modern::Perl;
use autodie;

use File::Basename;

use JSON;
use Data::Dumper;

use subs qw( load_json fix parse_args read_args get set add del );

my $abs_path = -l __FILE__ ? dirname(readlink __FILE__) : dirname(__FILE__);
################################### SETTINGS ###################################
my $F_COINS   = "$abs_path/../../data/coins";
my $F_BOTDATA = "$abs_path/../../data/botdata";
my $JSON      = JSON->new->canonical;

my %KRAKEN_LEV = (
    BTC_ETC  => 3,
    BTC_ETH  => 3,
    BTC_REP  => 2,
    EUR_BTC  => 3,
    USD_BTC  => 3,
    BTC_XMR  => 3,
    ETH_ETC  => 2,
    EUR_ETC  => 2,
    USD_ETC  => 2,
    USD_ETH  => 3,
    ETH_REP  => 2,
    EUR_REP  => 2,
    USD_USDT => 2,
    USD_XMR  => 2,
    EUR_XMR  => 2,
);
################################################################################


#system("perl create_coin_list.pl $F_COINS") unless -e $F_COINS;


################################# LOADING DATA #################################
my %coins   = %{ load_json $F_COINS };
my @botdata = @{ load_json $F_BOTDATA };
################################################################################

################################### MESSAGES ###################################
my $M_HELP = fix <<HELP;
    Usage: ./configure bot
           ./configure bot [--where] [OPTIONS]... --METHOD  [OPTIONS]...
           ./configure bot  --METHOD [OPTIONS]... [--where] [OPTIONS]...
    
    Get the botdata with '--where [OPTIONS]' constructions and
    do something with it with the help of one of the METHODS.
    
    With no arguments works in the interactive mode.
    
    Mandatory arguments to long options are mandatory for short options too.
      --help                     display this help and exit
    
    METHODS:
      --add                      add the instances matching with --where with
                                   options coming after the method to botdata.
      --set                      set the instances matching with --where to
                                   options coming after the method in botdata.
      --del                      delete the instances matching with --where
                                   from botdata.
      --get                      print botdata matching with --where to console.
    
    OPTIONS:
      -c                         coin LIST as regular expressions.
                                   E.g. '-c USD*' are all USD currences, 
                                   '-c *XMR' all XMR are currences and so on.
                                   You can also list them with spaces as:
                                   '-c USD_XMR BTC* BTC_X??'
      -H                         high_market.name LIST as regular expressions.
                                   E.g. '-H b\\* kraken' for any market starting
                                   with "b" and kraken.
      -L                         low_market.name LIST as regular expressions.
                                   E.g. '-H b\\* kraken' for any market starting
                                   with "b" and kraken.
      -sH                        spread_high VALUE as integer or decimal.
                                   E.g. '-sH 5' or '-sH 1.4' or '-sH -0.8'.
      -sL                        spread_low VALUE as integer or decimal.
                                   E.g. '-sL 5' or '-sL 1.4' or '-sL -0.8'.
      -Hs                        high_market.step VALUE as integer or decimal.
                                   E.g. '-Hs 5' or '-Hs 1.4' or '-Hs -0.8'.
      -Ls                        low_market.step VALUE as integer or decimal.
                                   E.g. '-Ls 5' or '-Ls 1.4' or '-Ls -0.8'.
      -Hl                        high_market.lev VALUE as natural integer or 0.
                                   E.g. '-Hl 5' or '-Hl 0'.
      -Ll                        low_market.lev VALUE as natural integer or 0.
                                   E.g. '-Ll 5' or '-Ll 0'.
    EXAMPLES:
      ./configure bot --add -sH 1 -sL -0.2
      ./configure bot --where -c USD* -H bitfinex --set -sH 0.8
      ./configure bot --del --where -L kraken && ./chbot --del --where -H kraken
      ./configure bot --get --where -sH 1
      ./configure bot --where -sH 0.8 --get
HELP

my $E_BADARGS = "Error: Bad arguments.";
my $E_TOO_MANY_METHODS = "Error: There can be not more then 1 method.";
my $E_NO_METHODS = "Error: No method was set. Methods: --get --set --add --del";
my $E_NOT_FOUND = "Error: No instances found.";
my $E_INVALID_VALUE = "Error: Invalid value '!val!' of the parameter '!param!'.";
my $E_NO_VALUE = "Error: Please set value for the '!param!' parameter.";
################################################################################

################################### CONSTANTS ##################################
my $METHOD  = undef;
my @METHODS = (
    'get',
    'set',
    'add',
    'del',
);

my %METHODS_TABLE = (
    get => \&get,
    set => \&set,
    add => \&add,
    del => \&del,
);

my @MARGIN = ( 'bitfinex', 'kraken', 'bittrex_GO', 'bitfinex_GO' );

# WHERE high = 'kraken', low = '*', coins = 'USD_*' '*_XMR'
#+ SET spread_high = 1.9, spread_low = -0.5;
# WHERE [key == value, key == value]
#+ SET [key = value, key == value]
#+ DELETE WHERE key == value
#+ ADD { key = value, key = value, key = value }
# Gets data form the coins file.                        # --where
my %WHERE = (
    high             => [ ".+" ], # high_market->{name} # -H   # default  *
    low              => [ ".+" ], # low_market->{name}  # -L   # default  *
    coins            => [ ".+" ], # coin                # -c   # default  *
    
    spread_high      => ".+",     # spread_high         # -sH  # optional
    spread_low       => ".+",     # spread_low          # -sL  # optional
    wait             => ".+",     # wait                # -w   # optional
    
    high_market_step => ".+",     # high_market->{step} # -Hs  # optional
    low_market_step  => ".+",     # low_market->{step}  # -Ls  # optional
    high_market_lev  => ".+",     # high_market->{lev}  # -Hl  # optional
    low_market_lev   => ".+",     # low_market->{lev}   # -Ll  # optional
);

# Set values                                            # --set or --add
my %SET = (
    spread_high      =>  1.4,     # spread_high         # -sH  # default  1.4
    spread_low       =>  0.2,     # spread_low          # -sL  # default -0.2
    wait             => 'none',   # wait                # -w   # default  none
    
    high_market_step => 0,        # high_market->{step} # -Hs  # default  0
    low_market_step  => 0,        # low_market->{step}  # -Ls  # default  0
    high_market_lev  => 3,        # high_market->{lev}  # -Hl  # default  2
    low_market_lev   => 3,        # low_market->{lev}   # -Ll  # default  2
);
################################################################################

################################### FUNCTIONS ##################################
sub load_json {
    my $fname = shift;
    my $result;

    open(my $fh, '<', $fname);
    while (<$fh>) {
        $result .= $_;
    }
    close($fh);
    
    return decode_json $result;
}
# Fix here docs.
sub fix {
    local $_ = shift;
    my ($white, $leader);  # common whitespace and common leading string
    if (/^\s*(?:([^\w\s]+)(\s*).*\n)(?:\s*\g1\g2?.*\n)+$/) {
        ($white, $leader) = ($2, quotemeta($1));
    } 
    else {
        ($white, $leader) = (/^(\s+)/, '');
    }
    s/^\s*?$leader(?:$white)?//gm;
    return $_;
}

# Check the values passed to the program.
my $check; # Targets the param type.
sub check {
    my $invalid; # Flag for invalid value.
    
    local $_ = shift;
    die $E_NO_VALUE =~ s/!param!/$check/r if not defined $_ or $_ eq "";
    
    # Make some shortcuts work.
    s/.*/*/ if /^all$/;
    s/\*/.+/g if /\*/;
    
    
    # Validate parameters by the type.
    if ($check =~ /^-c$/) {
        my $val   = $_; # for grep.
        my @coins;
        push @coins, @{ $coins{$_} } for keys %coins;
        $invalid  = 1 unless grep {/^$val$/} @coins;
    }
    elsif ($check =~ /^-(H|L)$/) {
        my $val = $_; # for grep.
        $invalid = 1 unless grep {/^$val$/} keys %coins;
    }
    elsif ($check =~ /^-w$/) {
        $invalid = 1 unless /^(none|both|high|low)$/;
    }
    elsif ($check =~ /^-(sH|sL|Hs|Ls)$/) {
        $invalid = 1 unless /^-?\d+(\.\d+)?$/; # decimal
    }
    elsif ($check =~ /^-(Hl|Ll)$/) {
        $invalid = 1 unless /^\d+$/; # integer
    }
    $invalid = 0 if $_ =~ /--/; # fix method next
    
    die $E_INVALID_VALUE =~ s/!val!/$_/r =~ s/!param!/$check/r if $invalid;
    return $_;
}

# Double click or console pro user.
sub has_args {
    if (@ARGV) {
        return 1;
    }
    else {
        return 0;
    }
}

sub get_args {
    if (has_args) {
        parse_args;
    }
    else {
        read_args;
    }
}

sub parse_args {
    @_ = @ARGV;
    
    my $func = shift;
    
    do {
        if ($func =~ /^--where$/) {
            say '--where';
            while( ($_ = $func = shift) and not /--/ ) {
                if    ( ($check) = /^(-H)$/ )  {
                    my $val;
                    $WHERE{high} = [];
                    while ( $val = shift and $val !~ /(^-\w+$|--)/ ) {
                        push @{ $WHERE{high} }, check $val;
                    }
                    unshift @_, $val if $val and $val =~ /(^-\w+$|--)/;
                }
                elsif ( ($check) = /^(-L)$/ )  {
                    my $val;
                    $WHERE{low} = [];
                    while ( $val = shift and $val !~ /(^-\w+$|--)/ ) {
                        push @{ $WHERE{low} }, check $val;
                    }
                    unshift @_, $val if $val and $val =~ /(^-\w+$|--)/;
                }
                elsif ( ($check) = /^(-c)$/ )  {
                    my $val;
                    $WHERE{coins} = [];
                    while ( $val = shift and $val !~ /(^-\w+$|--)/ ) {
                        push @{ $WHERE{coins} }, check $val;
                    }
                    unshift @_, $val if $val and $val =~ /(^-\w+$|--)/;
                }
                elsif ( ($check) = /^(-sH)$/ ) {
                    $WHERE{spread_high} = check shift;
                }
                elsif ( ($check) = /^(-sL)$/ ) {
                    $WHERE{spread_low} = check shift;
                }
                elsif ( ($check) = /^(-w)$/ )  {
                    $WHERE{wait} = check shift;
                }
                elsif ( ($check) = /^(-Hs)$/ ) {
                    $WHERE{high_market_step} = check shift;
                }
                elsif ( ($check) = /^(-Ls)$/ ) {
                    $WHERE{low_market_step} = check shift;
                }
                elsif ( ($check) = /^(-Hl)$/ ) {
                    $WHERE{high_market_lev} = check shift;
                }
                elsif ( ($check) = /^(-Ll)$/ ) {
                    $WHERE{low_market_lev} = check shift;
                }
                else {
                    die "$E_BADARGS '$func'";
                }
            }
            unshift @_, $_ if $_ and /--/ and not $_[0]; # Method at the end.
        }
        elsif ($func =~ /^--(??{ join '|', @METHODS })$/) {
            $METHOD = $METHOD ? die $E_TOO_MANY_METHODS : $func =~ s/--//r;
            say "Method '$METHOD'.";
            
            if ($METHOD =~ /^set$/) {
                $SET{spread_high}      = undef;
                $SET{spread_low}       = undef;
                $SET{wait}             = undef;
                $SET{high_market_step} = undef;
                $SET{low_market_step}  = undef;
                $SET{high_market_lev}  = undef;
                $SET{low_market_lev}   = undef;
            }
            
            while( ($_ = $func = shift) and not /--/ ) {
                
                if    ( ($check) = /^(-sH)$/ ) {
                    $SET{spread_high}      = check shift;
                }
                elsif ( ($check) = /^(-sL)$/ ) {
                    $SET{spread_low}       = check shift;
                }
                elsif ( ($check) = /^(-w)$/ )  {
                    $SET{wait}             = check shift;
                }
                elsif ( ($check) = /^(-Hs)$/) {
                    $SET{high_market_step} = check shift;
                }
                elsif ( ($check) = /^(-Ls)$/) {
                    $SET{low_market_step}  = check shift;
                }
                elsif ( ($check) = /^(-Hl)$/) {
                    $SET{high_market_lev}  = check shift;
                }
                elsif ( ($check) = /^(-Ll)$/) {
                    $SET{low_market_lev}   = check shift;
                }
                else {
                    die "$E_BADARGS '$func'";
                }
            }
            unshift @_, $_ if $_ and /^--help$/#|(??{ join '|', @METHODS }))$/
                                 and not $_[0]; # Method at the begining.
        }
        elsif ($func =~ /^--help$/) {
            die $M_HELP;
        }
        else {
            die "$E_BADARGS '$func'";
        }
    } while (@_);
}

sub read_args {
    say $M_HELP;
    say "INTERACTIVE MODE IS NOT IMPLEMENTED YET.\nRun 'perl chbot --help' "
       ."to get more info about\nhow to work in PRO developers mode. "
       ."Or look above.";
    say 'Press [ENTER] to continue.';
    readline;
    die "\n";
}


# Converts regexps of the user to real names. E.g. -H b* --> bitfinex, bittrex.
sub convert {
    my ($coins_ref, $high_ref, $low_ref);
    my $coins_re = join '|', @${ $coins_ref = $_[0]->{coins} };
    my $high_re  = join '|', @${ $high_ref  = $_[0]->{high}  };
    my $low_re   = join '|', @${ $low_ref   = $_[0]->{low}   };
    
    ${ $coins_ref } = [];
    ${ $high_ref  } = [];
    ${ $low_ref   } = [];
    for my $market (sort keys %coins) {
        for my $coin (@{ $coins{$market} }) {
            push @${ $coins_ref }, $coin  if $coin     =~ /^$coins_re$/
                             and not grep {/^$coin$/}   @${ $coins_ref };
            
            push @${ $high_ref }, $market if $market   =~ /^$high_re$/
                             and not grep {/^$market$/} @${ $high_ref };
            
            push @${ $low_ref },  $market if $market   =~ /^$low_re$/
                             and not grep {/^$market$/} @${ $low_ref };
        }
    }
}

# Select objects matching with <where> from botdata. (Tech function).
sub search_botdata {
    if    ( scalar @{ $WHERE{high}  } == 0 ) {
        die "Error: Not optional '-H' parameter is not set."
    }
    elsif ( scalar @{ $WHERE{low}   } == 0 ) {
        die "Error: Not optional '-L' parameter is not set."
    }
    elsif ( scalar @{ $WHERE{coins} } == 0 ) {
        die "Error: Not optional '-c' parameter is not set."
    }
    
    my @get;
    my @del;
    
    my $high_re  = qr/^(??{ join '|', @{ $WHERE{high}  } })$/;
    my $low_re   = qr/^(??{ join '|', @{ $WHERE{low}   } })$/;
    my $coins_re = qr/^(??{ join '|', @{ $WHERE{coins} } })$/;
    
    for my $data (@botdata) {
        push @del, $data
             if $data->{high_market}->{name} !~ /$high_re/
             or $data->{low_market}->{name}  !~ /$low_re/
             or $data->{coin}                !~ /$coins_re/
             or $data->{spread_high}         !~ /^$WHERE{spread_high}$/
             or $data->{spread_low}          !~ /^$WHERE{spread_low}$/
             or $data->{wait}                !~ /^$WHERE{wait}$/
             or $data->{high_market}->{step} !~ /^$WHERE{high_market_step}$/
             or $data->{low_market}->{step}  !~ /^$WHERE{low_market_step}$/
             or $data->{high_market}->{lev}  !~ /^$WHERE{high_market_lev}$/
             or $data->{low_market}->{lev}   !~ /^$WHERE{low_market_lev}$/;
        
        push @get, $data
             if $data->{high_market}->{name} =~ /$high_re/
            and $data->{low_market}->{name}  =~ /$low_re/
            and $data->{coin}                =~ /$coins_re/
            and $data->{spread_high}         =~ /^$WHERE{spread_high}$/
            and $data->{spread_low}          =~ /^$WHERE{spread_low}$/
            and $data->{wait}                =~ /^$WHERE{wait}$/
            and $data->{high_market}->{step} =~ /^$WHERE{high_market_step}$/
            and $data->{low_market}->{step}  =~ /^$WHERE{low_market_step}$/
            and $data->{high_market}->{lev}  =~ /^$WHERE{high_market_lev}$/
            and $data->{low_market}->{lev}   =~ /^$WHERE{low_market_lev}$/;
    }
    scalar @get or die $E_NOT_FOUND;
    
    return ( { get => \@get, del => \@del } );
}

# Select base objects matching with <where> from coins. (Tech function).
sub search_coins {
    if    ( scalar @{ $WHERE{high}  } == 0 ) {
        die "Error: Not optional '-H' parameter is not set."
    }
    elsif ( scalar @{ $WHERE{low}   } == 0 ) {
        die "Error: Not optional '-L' parameter is not set."
    }
    elsif ( scalar @{ $WHERE{coins} } == 0 ) {
        die "Error: Not optional '-c' parameter is not set."
    }
    
    my @bases;
    
    convert({
        coins => \$WHERE{coins},
        high  => \$WHERE{high},
        low   => \$WHERE{low},
    });
    
    for my $coin ( @{ $WHERE{coins} } ) {
        for my $high ( @{ $WHERE{high} } ) {
            for my $low ( @{ $WHERE{low} } ) {
                # Pass if coin doesn't match.
                next if     $high eq $low
                       or   (not grep {/^$high$/} @MARGIN
                         and not grep {/^$low$/ } @MARGIN)
                       or    not grep {/^$coin$/} @{ $coins{$high} }
                       or    not grep {/^$coin$/} @{ $coins{$low}  };
                
                my %base = (
                    coin => $coin,
                    high => $high =~ s/_GO//r,
                    low  => $low  =~ s/_GO//r,
                );
                push @bases, \%base;
            }
        }
    }
    scalar @bases or die $E_NOT_FOUND;
    
    return @bases;
}

# Get objects matching with <where> from botdata.
sub get {
    my @result = @{ search_botdata->{get} };
    #say Dumper(@result);
    
    return $JSON->encode(\@result);
}

# Set matching with <where> objects.
sub set {
    my $buffer = search_botdata;
    my @to_change = @{ $buffer->{get} };
    my @no_change = @{ $buffer->{del} };
    
    my @result;
    
    # Set values if needed.
    for my $data (@to_change) {
        $data->{spread_high} = $SET{spread_high} if defined $SET{spread_high};
        $data->{spread_low}  = $SET{spread_low}  if defined $SET{spread_low};
        $data->{wait}        = $SET{wait}        if defined $SET{wait};
        
        $data->{high_market}->{step} = $SET{high_market_step}
                                             if defined $SET{high_market_step};
        $data->{low_market}->{step}  = $SET{low_market_step}
                                             if defined $SET{low_market_step};
        $data->{high_market}->{lev}  = $SET{high_market_lev}
                                             if defined $SET{high_market_lev};
        $data->{low_market}->{lev}   = $SET{low_market_lev}
                                             if defined $SET{low_marke_lev};
        
        push @result, $data;
    }
    push @result, @no_change;
    #say Dumper(@result);
    
    return $JSON->encode(\@result);
}

# Create matching <coins> botdata.
sub add {
    my @bases = search_coins;
    
    $WHERE{$_} =   ".+"   for keys %WHERE;
    $WHERE{$_} = [ ".+" ] for ( "high", "low", "coins" );
    my @old    = scalar @botdata ? @{ search_botdata->{get} } : ();
    my @result;
    
    for my $base (@bases) {
        my $high_lev = $SET{high_market_lev};
        my $low_lev  = $SET{low_market_lev};
        
        if ($base->{high} eq "kraken") {
            $high_lev = $KRAKEN_LEV{ $base->{coin} };
        }
        elsif ($base->{low}  eq "kraken") {
            $low_lev  = $KRAKEN_LEV{ $base->{coin} };
        }
        
        my %obj = (
            coin        => $base->{coin},
            high_market => {
                name => $base->{high},
                step => $SET{high_market_step},
                lev  => $high_lev,
            },
            low_market  => {
                name => $base->{low},
                step => $SET{low_market_step},
                lev  => $low_lev,
            },
            spread_high => $SET{spread_high},
            spread_low  => $SET{spread_low},
            wait        => $SET{wait},
        );
        push @result, \%obj;
    }
    push @result, @old;
    
    #say Dumper @result;
    
    return $JSON->encode(\@result);
}

# Delete matching with <where> objects.
sub del {
    my @survived = @{ search_botdata->{del} };
    #say Dumper(@survived);
    
    return $JSON->encode(\@survived);
}

sub format_json {
    my $ref;
    my $buffer = ${ $ref = $_[0] };
    $ref = "";
    
    
    
    $ref = $buffer;
}

sub main() {
    get_args;
    my $res = $METHOD ? $METHODS_TABLE{$METHOD}() : die $E_NO_METHODS;
    
    my $botdata; # Filehandler to botdata file or STDOUT.
    if ($METHOD =~ /^get$/) {
        open($botdata, '>&', \*STDOUT);
    }
    else {
        open($botdata, '>', $F_BOTDATA);
    }
    
    format_json \$res; 
    
    print $botdata $res;
    
    close($botdata);
}

main();

1;
