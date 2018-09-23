#!/usr/bin/env perl

# optimize.pl
# Written by dta90d on 2017.12.07.
# Optimize FULL coin dict with options to fast program version.

use Modern::Perl '2014';
use autodie;

use subs qw( get_margin_markets );

use JSON;
use File::Basename;


my $abs_path = -l __FILE__ ? dirname(readlink __FILE__) : dirname(__FILE__);
################################### SETTINGS ###################################
my $F_FULL      = $ARGV[0] || "$abs_path/../../data-static/coin_dict.full";
my $F_COINDICT  = $ARGV[1] || "$abs_path/../../data/coin_dict";
my $F_USEDCOINS = "$abs_path/../../data/.used_coins";
my $F_MARGCOINS = "$abs_path/../../data/.margin_coins";
my $F_MAINJS    = "$abs_path/../../dtarbitragec.js";
my $JSON        = JSON->new->canonical;

my @MARGIN_MARKETS = get_margin_markets $F_MAINJS;

################################### HELP FUNC ##################################
sub read_file {
    my $fname = shift;
    
    open my $fh, '<', $fname;
        my $data = do { local $/; <$fh>; };
    close $fh;
    
    return $data;
}

sub write_file {
    my $fname = shift;
    my $data  = shift;
    
    return 0 if not $fname;
    
    open my $fh, '>', $fname;
        print $fh $data;
    close $fh;
    
    return 1;
}

sub get_margin_markets {
    my $fname = shift;
    
    my @margin_markets;
    open my $fh, '<', $fname;
        while (<$fh>) {
            chomp;
            if (/^const\s+MARGIN_MARKETS\s+=\s+\[(.*?)\]\s*;?\s*$/) {
                @margin_markets = split /\s*,\s*/, $1;
                last;
            }
        }
    close $fh;
    
    foreach (@margin_markets) {
        s/\W//g;
    }
    
    return @margin_markets;
}

sub format_json {
    my $data = shift;
    my @keys = @_;
    
    my $space = ' ' x 4;
    
    $data =~ s/(\{|\[|,)/$1\n/g;
    $data =~ s/(\}|\])/\n$1/g;
    
    my @lines = split "\n", $data;
    my $i = 0;
    for my $line (@lines) {
        
        $i-- if $line =~ /(\}|\]),?$/;
        $line = $space x $i . $line;
        $i++ if $line =~ /(\{|\[)$/;
    }
    $data = join "\n", @lines;
    
    return $data;
}


my %full_cd = %{ decode_json( read_file $F_FULL ) };

my @margin_coins;
for my $market (keys %full_cd) {
    next if not grep {/^$market$/} @MARGIN_MARKETS or not $full_cd{$market}->{on} eq 'true';
    
    for my $key (keys %{ $full_cd{$market} }) {
        next if $key eq 'on';
        
        my $coin = $full_cd{$market}->{$key};
        push @margin_coins, $coin unless grep {/^$coin$/} @margin_coins;
    }
}
@margin_coins = sort @margin_coins;
write_file $F_MARGCOINS, "Count: " . scalar @margin_coins . "\n" . format_json( $JSON->encode( \@margin_coins ) );


my @used_coins;
my %optimized;
for my $market (keys %full_cd) {
    next if $full_cd{$market}->{on} eq 'false';
    
    $optimized{$market} = {};
    
    for my $key (keys %{ $full_cd{$market} }) {
        next if $key eq 'on';
        
        my $coin = $full_cd{$market}->{$key};
        
        if ( grep {/^$coin$/} @margin_coins ) {
            $optimized{$market}->{$key} = $coin;
            
            push @used_coins, $coin;
        }
    }
    $optimized{$market} = undef unless $optimized{$market};
}

my @buffer  = @used_coins;

@used_coins = ();
for my $coin (@buffer) {
    if ( (scalar grep {/^$coin$/} @buffer) > 1 ) {
        push @used_coins, $coin unless grep {/^$coin$/} @used_coins;
    }
}
@used_coins = sort @used_coins;

write_file $F_USEDCOINS, "Count: " . scalar @used_coins . "\n" . format_json( $JSON->encode( \@used_coins ) );
write_file $F_COINDICT, format_json( $JSON->encode( \%optimized ) );
